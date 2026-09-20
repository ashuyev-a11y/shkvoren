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
  return `${head}, ${line.qty} шт x ${formatPrice(line.price)} = ${formatPrice(line.sum)}`;
}

/**
 * Текст сообщения.
 *
 * @param lines позиции заказа; пустой массив — обращение без заказа
 * @param phone телефон покупателя; строка добавляется только если он заполнен
 */
export function buildMessage(lines: OrderLine[], phone: string): string {
  const rows: string[] = [];

  if (lines.length === 0) {
    rows.push(GREETING_EMPTY);
  } else {
    rows.push(GREETING_ORDER);
    for (const line of lines) rows.push(formatLine(line));
    const total = lines.reduce((sum, line) => sum + line.sum, 0);
    rows.push(`Итого: ${formatPrice(total)}`);
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
export function buildWhatsappUrl(lines: OrderLine[], phone: string): string {
  const number = (process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? '').replace(/\D/g, '');
  if (number === '') {
    throw new Error(
      'Не задана переменная NEXT_PUBLIC_WHATSAPP_NUMBER. Заполните .env.local по образцу .env.example.'
    );
  }

  return `${WHATSAPP_BASE}/${number}?text=${encodeURIComponent(buildMessage(lines, phone))}`;
}
