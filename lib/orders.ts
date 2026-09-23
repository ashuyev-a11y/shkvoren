/**
 * Правила заказа: номер, позиции, строка листа «Заказы».
 *
 * Состав колонок задан в docs/data-model.md §8, номер — решением 4.
 *
 * Модуль намеренно не обращается к Google-таблице и не помечен 'server-only':
 * здесь только чистые функции, и они покрыты тестами без доступа к сети.
 * Запись живёт в lib/orders-write.ts.
 */
import { formatPrice } from './format.ts';
import type { AdminPart } from '../types/part.ts';
import type { Order, OrderDraftItem, OrderLine } from '../types/order.ts';

/** Часовой пояс Уральска: UTC+5 круглый год, перехода на летнее время нет. */
const URALSK_OFFSET_MINUTES = 5 * 60;

/** Префикс номера заказа (решение 4). */
const ORDER_PREFIX = 'ШКВ';

/** Разрядность номера: ШКВ-0001. */
const ORDER_DIGITS = 4;

/**
 * Предел длины комментария к заказу (решение 18.1: 200–300 символов).
 * Строже не валидируем: лишнее обрезается, заказ не отклоняется.
 */
export const COMMENT_MAX = 300;

/**
 * Привести комментарий к виду для записи: без крайних пробелов, переносы
 * строк схлопнуты в пробел (в сообщении и в ячейке комментарий — одна
 * строка), длина не больше COMMENT_MAX. Пустой результат — комментария нет.
 */
export function normalizeComment(input: string | null | undefined): string {
  return (input ?? '').replace(/\s+/g, ' ').trim().slice(0, COMMENT_MAX);
}

/** Ошибка, которую можно показать покупателю: текст написан для него. */
export class OrderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OrderError';
  }
}

/**
 * Номер заказа из фактического числа строк листа.
 *
 * Считается на сервере непосредственно перед записью, а не из счётчика
 * в приложении: иначе после перезапуска нумерация начнётся заново.
 *
 * @param rows сколько строк занято в листе, включая заголовок
 */
export function buildOrderNo(rows: number): string {
  // Строка 1 — заголовки, поэтому первый заказ получает номер 1.
  const next = Math.max(rows, 1);
  return `${ORDER_PREFIX}-${String(next).padStart(ORDER_DIGITS, '0')}`;
}

/** Время в формате ISO 8601 с часовым поясом Уральска. */
export function uralskTimestamp(now = new Date()): string {
  const shifted = new Date(now.getTime() + URALSK_OFFSET_MINUTES * 60_000);
  const sign = URALSK_OFFSET_MINUTES >= 0 ? '+' : '-';
  const hours = String(Math.floor(Math.abs(URALSK_OFFSET_MINUTES) / 60)).padStart(2, '0');
  const minutes = String(Math.abs(URALSK_OFFSET_MINUTES) % 60).padStart(2, '0');
  return `${shifted.toISOString().slice(0, 19)}${sign}${hours}:${minutes}`;
}

/**
 * Собрать позиции заказа по данным каталога.
 *
 * Цена берётся здесь, из таблицы, а не из запроса браузера
 * (docs/technical-spec.md §6): присланная клиентом цена игнорируется.
 *
 * @throws OrderError если позиция не найдена или количество больше остатка
 */
export function buildLines(items: OrderDraftItem[], parts: AdminPart[]): OrderLine[] {
  if (items.length === 0) {
    throw new OrderError('Добавьте хотя бы одну позицию.');
  }

  const byId = new Map(parts.map((part) => [part.id, part]));
  const lines: OrderLine[] = [];

  for (const item of items) {
    const part = byId.get(item.id);
    if (!part) {
      // Позиция исчезла из таблицы или скрыта фильтром марок.
      throw new OrderError('Одна из позиций больше не продаётся. Обновите страницу.');
    }
    if (!Number.isInteger(item.qty) || item.qty < 1) {
      throw new OrderError(`«${part.title}»: количество должно быть целым числом от 1.`);
    }
    if (item.qty > part.qty) {
      throw new OrderError(`«${part.title}»: в наличии ${part.qty} шт, заказано ${item.qty} шт.`);
    }

    /*
     * Предложение покупателя (решение 18). Проверка только базовая: число
     * больше нуля. Отсечки «не ниже прайса» здесь нет намеренно — цена
     * в таблице и так себестоимость (решение 0), поэтому предложение ниже
     * неё — осознанный торг, а не ошибка ввода. Соглашаться или нет,
     * решает продавец в переписке.
     */
    const offeredPrice = item.offeredPrice ?? null;
    if (offeredPrice !== null && (!Number.isInteger(offeredPrice) || offeredPrice < 1)) {
      throw new OrderError(`«${part.title}»: предложенная цена должна быть целым числом от 1.`);
    }

    lines.push({
      id: part.id,
      title: part.title,
      article: part.article,
      qty: item.qty,
      price: part.price,
      offeredPrice,
      // Считаем по предложенной цене, если она есть: покупатель видит в итоге
      // ту сумму, которую предлагает заплатить.
      sum: (offeredPrice ?? part.price) * item.qty,
    });
  }

  return lines;
}

/** Сумма строк заказа: по предложенным ценам там, где они есть. */
export function orderTotal(lines: OrderLine[]): number {
  return lines.reduce((sum, line) => sum + line.sum, 0);
}

/** Сумма строк по прайсу, без учёта построчных предложений. */
export function listTotal(lines: OrderLine[]): number {
  return lines.reduce((sum, line) => sum + line.price * line.qty, 0);
}

/**
 * Действующий итог заказа (решение 18).
 *
 * Сумма за весь заказ побеждает построчные предложения: если покупатель
 * торгуется за партию целиком, одна цифра отменяет разбивку. Построчные
 * при этом не теряются — они остаются в строках и доходят до продавца.
 */
export function effectiveTotal(lines: OrderLine[], offeredTotal: number | null): number {
  return offeredTotal ?? orderTotal(lines);
}

/**
 * Состав в машинном виде: «12x2; 48x1» (колонка F).
 * Нужен, чтобы заказ можно было разобрать обратно по ключам позиций.
 *
 * Предложенная цена дописывается через «@»: «12x2@15000». Обе цены в одной
 * ячейке не смешиваются — прайсовая всегда доступна по ключу в каталоге.
 */
function compactComposition(lines: OrderLine[]): string {
  return lines
    .map((line) => {
      const base = `${line.id}x${line.qty}`;
      return line.offeredPrice === null ? base : `${base}@${line.offeredPrice}`;
    })
    .join('; ');
}

/**
 * Состав в читаемом виде (колонка G): по строке на позицию.
 * Оператор собирает заказ по этой колонке, не сверяясь с каталогом.
 *
 * При торге в строке видны обе цены: по прайсу и предложенная (решение 18).
 */
function readableComposition(lines: OrderLine[]): string {
  return lines
    .map((line) => {
      const head = line.article ? `${line.article} — ${line.title}` : line.title;
      const row = `${head}, ${line.qty} шт × ${formatPrice(line.price)} = ${formatPrice(line.price * line.qty)}`;
      if (line.offeredPrice === null) return row;
      return `${row} (предложено: ${formatPrice(line.offeredPrice)}/шт = ${formatPrice(line.sum)})`;
    })
    .join('\n');
}

/**
 * Строка листа «Заказы», колонки A..K (docs/data-model.md §8).
 *
 * Колонка K — комментарий покупателя (решение 18.1), пусто без комментария.
 *
 * Колонки I и J появились вместе с торгом (решение 18): в E попадает
 * действующий итог — сумма, которую покупатель предлагает заплатить, —
 * а в J остаётся итог по прайсу, чтобы продавец видел, от чего торгуются.
 */
export function buildRow(order: Order): string[] {
  return [
    order.orderNo,
    order.createdAt,
    order.phone,
    String(order.lines.length),
    String(order.total),
    compactComposition(order.lines),
    readableComposition(order.lines),
    order.status,
    order.offeredTotal === null ? '' : String(order.offeredTotal),
    String(listTotal(order.lines)),
    normalizeComment(order.comment),
  ];
}

/**
 * Собрать заказ, не записывая его.
 *
 * @param rows сколько строк занято в листе «Заказы» на данный момент
 */
export function buildOrder(
  lines: OrderLine[],
  phone: string,
  rows: number,
  offeredTotal: number | null = null,
  comment: string | null = null
): Order {
  if (offeredTotal !== null && (!Number.isInteger(offeredTotal) || offeredTotal < 1)) {
    throw new OrderError('Предложенная сумма за заказ должна быть целым числом от 1.');
  }

  return {
    orderNo: buildOrderNo(rows),
    createdAt: uralskTimestamp(),
    phone: phone.trim(),
    lines,
    total: effectiveTotal(lines, offeredTotal),
    offeredTotal,
    comment: normalizeComment(comment),
    status: 'новый',
  };
}
