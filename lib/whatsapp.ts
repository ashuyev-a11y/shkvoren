/**
 * Сборка сообщения и ссылки WhatsApp.
 *
 * Текст задан решением 12 в docs/decisions.md и помечен там как
 * зафиксированный и протестированный. Менять формулировки, добавлять строки
 * или эмодзи запрещено — шаблон воспроизводится дословно.
 *
 * Это единственное место в проекте, которое знает адрес wa.me
 * (проверяется scripts/check-guards.mjs).
 */
import { formatPrice, normalizePhone } from './format.ts';
import type { OrderLine } from '../types/order.ts';

/** Базовый адрес ссылки. */
const WHATSAPP_BASE = 'https://wa.me';

/** Первая строка, когда покупатель ничего не выбрал. */
const GREETING_EMPTY =
  'Здравствуйте! Интересует распродажа склада ГАЗ/УАЗ по себестоимости.';

/** Первая строка, когда в корзине есть позиции. */
const GREETING_ORDER = 'Здравствуйте! Хочу заказать по распродаже склада:';

/**
 * Строка одной позиции: «<номер> — <название>, <кол-во> шт x <цена> = <сумма>».
 *
 * Артикул есть не у всех позиций (93 из 278 без номера, docs/data-model.md §2).
 * В этом случае строка начинается с названия: подставлять «номер не указан»
 * в сообщение продавцу бессмысленно, он и так видит название.
 */
function formatLine(line: OrderLine): string {
  const head = line.article ? `${line.article} — ${line.title}` : line.title;
  // В основной части строки всегда цена по прайсу: продавец должен видеть,
  // от чего торгуются. Предложение идёт пометкой рядом (решение 18).
  const row = `${head}, ${line.qty} шт x ${formatPrice(line.price)} = ${formatPrice(line.price * line.qty)}`;
  // Сравнение нестрогое: у строк, собранных не через buildLines, поля может
  // не быть вовсе, и строгая проверка напечатала бы «предложено: undefined».
  const offered = line.offeredPrice ?? null;
  if (offered === null) return row;
  return `${row} (предложено: ${formatPrice(offered)}/шт)`;
}

/**
 * Текст сообщения.
 *
 * @param lines позиции заказа; пустой массив — обращение без заказа
 * @param phone телефон покупателя; строка добавляется только если он заполнен
 */
export function buildMessage(
  lines: OrderLine[],
  phone: string,
  offeredTotal: number | null = null
): string {
  const rows: string[] = [];

  if (lines.length === 0) {
    rows.push(GREETING_EMPTY);
  } else {
    rows.push(GREETING_ORDER);
    for (const line of lines) rows.push(formatLine(line));

    const list = lines.reduce((sum, line) => sum + line.price * line.qty, 0);
    const offered = offeredTotal ?? lines.reduce((sum, line) => sum + line.sum, 0);


    if (offered === list) {
      // Торга нет — шаблон решения 12 воспроизводится дословно.
      rows.push(`Итого: ${formatPrice(list)}`);
    } else {
      // Обе суммы рядом: одна «Итого» без пояснения оставила бы продавца
      // гадать, прайс это или предложение (решение 18).
      rows.push(`Итого по прайсу: ${formatPrice(list)}`);
      rows.push(`Итого (предложение покупателя): ${formatPrice(offered)}`);
    }
  }

  // Решение 12: строка с телефоном добавляется только при заполненном поле.
  if (normalizePhone(phone).length > 0) {
    rows.push(`Мой телефон: ${phone.trim()}`);
  }

  return rows.join('\n');
}

/**
 * Ссылка на переписку с продавцом.
 *
 * Номер берётся из окружения и не хардкодится в компонентах (решение 13).
 * Отсутствие переменной — отказ: молча открыть пустой WhatsApp хуже,
 * чем показать ошибку.
 */
export function buildWhatsappUrl(
  lines: OrderLine[],
  phone: string,
  offeredTotal: number | null = null
): string {
  const number = (process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? '').replace(/\D/g, '');
  if (number === '') {
    throw new Error(
      'Не задана переменная NEXT_PUBLIC_WHATSAPP_NUMBER. Заполните .env.local по образцу .env.example.'
    );
  }

  const text = buildMessage(lines, phone, offeredTotal);
  return `${WHATSAPP_BASE}/${number}?text=${encodeURIComponent(text)}`;
}
