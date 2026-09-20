/**
 * Реквизиты продавца для летерхеда бланка — решение 3.
 *
 * Значения берутся только из переменных окружения. Придумывать адрес и
 * телефон запрещено (AGENTS.md), поэтому незаполненная переменная означает
 * отсутствие строки в летерхеде, а не подставленный образец.
 *
 * Бланк не фискальный документ: БИН, НДС и подписи в нём не предусмотрены
 * (решение 3, расхождение с product-spec.md зафиксировано в docs/README.md).
 */

/** Название продавца. Единственное значение, которое задано брендбуком. */
export const SELLER_NAME = 'ШКВОРЕНЬ';

/** Строки летерхеда, которые удалось собрать из окружения. */
export function sellerLines(): string[] {
  const lines: string[] = [];

  const address = process.env.NEXT_PUBLIC_SELLER_ADDRESS?.trim();
  if (address) lines.push(address);

  const phone = process.env.NEXT_PUBLIC_SELLER_PHONE?.trim();
  if (phone) lines.push(phone);

  return lines;
}
