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

    lines.push({
      id: part.id,
      title: part.title,
      article: part.article,
      qty: item.qty,
      price: part.price,
      sum: part.price * item.qty,
    });
  }

  return lines;
}

/** Итог заказа. */
export function orderTotal(lines: OrderLine[]): number {
  return lines.reduce((sum, line) => sum + line.sum, 0);
}

/**
 * Состав в машинном виде: «12x2; 48x1» (колонка F).
 * Нужен, чтобы заказ можно было разобрать обратно по ключам позиций.
 */
function compactComposition(lines: OrderLine[]): string {
  return lines.map((line) => `${line.id}x${line.qty}`).join('; ');
}

/**
 * Состав в читаемом виде (колонка G): по строке на позицию.
 * Оператор собирает заказ по этой колонке, не сверяясь с каталогом.
 */
function readableComposition(lines: OrderLine[]): string {
  return lines
    .map((line) => {
      const head = line.article ? `${line.article} — ${line.title}` : line.title;
      return `${head}, ${line.qty} шт × ${formatPrice(line.price)} = ${formatPrice(line.sum)}`;
    })
    .join('\n');
}

/** Строка листа «Заказы», колонки A..H (docs/data-model.md §8). */
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
  ];
}

/**
 * Собрать заказ, не записывая его.
 *
 * @param rows сколько строк занято в листе «Заказы» на данный момент
 */
export function buildOrder(lines: OrderLine[], phone: string, rows: number): Order {
  return {
    orderNo: buildOrderNo(rows),
    createdAt: uralskTimestamp(),
    phone: phone.trim(),
    lines,
    total: orderTotal(lines),
    status: 'новый',
  };
}
