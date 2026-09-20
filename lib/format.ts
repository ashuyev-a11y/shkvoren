/**
 * Форматирование чисел и телефонов.
 *
 * Правила из tokens.json (стиль «price») и README (3).md:
 * пробел-разделитель тысяч, символ ₸, табличные цифры.
 * Придумывать другие форматы запрещено (AGENTS.md).
 */

/** Неразрывный узкий пробел: разряды не разорвутся при переносе строки. */
const THIN_NBSP = '\u202F';

/**
 * Разряды числа через пробел: 17500 → «17 500».
 * Дробной части в данных нет (цены и остатки целые, data-model.md §4),
 * поэтому дробь отбрасывается округлением, а не форматируется.
 */
export function formatNumber(value: number): string {
  const rounded = Math.round(value);
  const sign = rounded < 0 ? '-' : '';
  const digits = String(Math.abs(rounded));

  let out = '';
  for (let i = 0; i < digits.length; i += 1) {
    // Пробел перед каждой третьей цифрой с конца, кроме начала строки.
    if (i > 0 && (digits.length - i) % 3 === 0) out += THIN_NBSP;
    out += digits[i];
  }
  return sign + out;
}

/** Цена с валютой: 17500 → «17 500 ₸». */
export function formatPrice(value: number): string {
  return `${formatNumber(value)}${THIN_NBSP}₸`;
}

/**
 * Количество на складе. Показываем точное число (решение 8):
 * опту нужно решение по объёму, а не факт наличия.
 */
export function formatQty(value: number): string {
  return `${formatNumber(value)} шт`;
}

/**
 * Очистка телефона до цифр для проверки и ссылки.
 * Ведущая «8» казахстанского формата приводится к «7».
 */
export function normalizePhone(input: string): string {
  const digits = input.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('8')) return `7${digits.slice(1)}`;
  return digits;
}

/**
 * Телефон валиден, если после очистки в нём 10–15 цифр
 * (technical-spec.md §6). Более жёсткую маску не ставим:
 * покупатель может быть из другой страны.
 */
export function isValidPhone(input: string): boolean {
  const digits = normalizePhone(input);
  return digits.length >= 10 && digits.length <= 15;
}
