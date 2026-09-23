/**
 * Запись заказа в лист «Заказы».
 *
 * Отделено от lib/orders.ts намеренно: там чистые правила, покрытые тестами
 * без доступа к сети, здесь — единственная операция записи во всём проекте.
 *
 * Заказ существует с момента успешной записи строки (решение 2): до неё
 * покупателю не показывается ни номер, ни ссылка на WhatsApp.
 */
import 'server-only';
import { appendRow, countRows, ordersSheetName } from './sheets.ts';
import { buildOrder, buildRow } from './orders.ts';
import type { Order, OrderLine } from '../types/order.ts';

/**
 * Записать заказ и вернуть его с присвоенным номером.
 *
 * Номер берётся из фактического числа строк листа непосредственно перед
 * записью (docs/data-model.md §8), а не из счётчика в приложении: иначе
 * после перезапуска нумерация начнётся заново.
 *
 * Ошибка записи пробрасывается вызывающему коду: редиректа в WhatsApp
 * при неудаче быть не должно, иначе покупатель уйдёт с заказом,
 * которого нет в таблице.
 */
export async function createOrder(
  lines: OrderLine[],
  phone: string,
  offeredTotal: number | null = null,
  comment: string | null = null
): Promise<Order> {
  const sheet = ordersSheetName();
  const rows = await countRows(sheet);
  const order = buildOrder(lines, phone, rows, offeredTotal, comment);

  await appendRow(sheet, buildRow(order));
  return order;
}
