/**
 * Уведомление продавца о новом заказе — решение 17.
 *
 * Зачем вообще: переход в WhatsApp не отправляет сообщение за покупателя, он
 * должен сам нажать «отправить» в приложении. Пока он этого не сделал, продавец
 * о заказе не знает, хотя строка в листе «Заказы» уже есть. Telegram закрывает
 * именно этот разрыв: сообщение уходит от сервера и не зависит от покупателя.
 *
 * Канал односторонний: кнопок, реакций и ответов менеджера обратно в систему
 * нет и не планируется (решение 17). Здесь только sendMessage.
 *
 * Модуль намеренно не помечен 'server-only' и не импортирует next:
 * текст собирается чистой функцией, покрытой тестами без доступа к сети.
 */
import { formatPrice } from './format.ts';
import type { Order, OrderLine } from '../types/order.ts';

/** Сколько ждём Telegram. Дольше держать заказ смысла нет: он уже записан. */
const TIMEOUT_MS = 3000;

/** Одна повторная попытка — на случай разрыва соединения, не больше. */
const ATTEMPTS = 2;

/**
 * Строка позиции. Формат совпадает с сообщением WhatsApp (решение 12):
 * продавец видит один и тот же состав в обоих каналах, и сверять их
 * построчно не приходится.
 *
 * Артикул есть не у всех позиций. Без него строка начинается с названия —
 * подставлять «номер не указан» продавцу незачем, он видит наименование.
 */
function formatLine(line: OrderLine): string {
  const head = line.article ? `${line.article} — ${line.title}` : line.title;
  const row = `${head}, ${line.qty} шт x ${formatPrice(line.price)} = ${formatPrice(line.price * line.qty)}`;
  // Поля может не быть вовсе у строк, собранных не через buildLines,
  // поэтому приводим к null, а не сравниваем строго.
  const offered = line.offeredPrice ?? null;
  if (offered === null) return row;
  return `${row} (предложено: ${formatPrice(offered)}/шт)`;
}

/** Есть ли в заказе хоть одно предложение цены (решение 18). */
function hasOffer(order: Order): boolean {
  if ((order.offeredTotal ?? null) !== null) return true;
  return order.lines.some((line) => (line.offeredPrice ?? null) !== null);
}

/**
 * Текст уведомления.
 *
 * Состав тот же, что в шаблоне WhatsApp, плюс номер заказа: по нему
 * продавец находит строку в листе «Заказы».
 */
export function buildNotification(order: Order): string {
  const rows: string[] = [];

  /*
   * Пометка о торге идёт первой строкой (решение 18): без неё продавец
   * рискует подтвердить заказ «по прайсу», не заметив, что сумма другая.
   */
  if (hasOffer(order)) rows.push('💬 Покупатель предложил цену');

  rows.push(`Новый заказ ${order.orderNo}`);

  for (const line of order.lines) rows.push(formatLine(line));

  const list = order.lines.reduce((sum, line) => sum + line.price * line.qty, 0);
  // Итог по прайсу и действующий совпадают, только если торга не было.
  if (order.total === list) {
    rows.push(`Итого: ${formatPrice(list)}`);
  } else {
    rows.push(`Итого по прайсу: ${formatPrice(list)}`);
    rows.push(`Итого (предложение покупателя): ${formatPrice(order.total)}`);
  }

  // Телефон обязателен при оформлении (решение 2), но заказ может прийти
  // и из админки в будущем — пустую строку в сообщении не оставляем.
  if (order.phone.trim() !== '') {
    rows.push(`Телефон покупателя: ${order.phone.trim()}`);
  }

  return rows.join('\n');
}

/** Адрес метода Bot API. Токен в путь подставляет только эта функция. */
function sendMessageUrl(token: string): string {
  return `https://api.telegram.org/bot${token}/sendMessage`;
}

/**
 * Отправить уведомление о заказе.
 *
 * Никогда не бросает исключение. Заказ к этому моменту уже записан в лист,
 * и падение Telegram не должно превращаться в ошибку у покупателя: он бы
 * увидел «не удалось оформить заказ» при том, что заказ оформлен.
 *
 * Возвращает true при успешной отправке — нужно тестам и логу, в потоке
 * заказа результат не проверяется.
 */
export async function notifyNewOrder(order: Order): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const chatId = process.env.TELEGRAM_CHAT_ID?.trim();

  if (!token || !chatId) {
    // Переменные не заведены — уведомления просто нет. Это не ошибка
    // конфигурации заказа: канал дополнительный, заказ уже в таблице.
    console.warn('Telegram не настроен: TELEGRAM_BOT_TOKEN или TELEGRAM_CHAT_ID пусты.');
    return false;
  }

  const body = JSON.stringify({ chat_id: chatId, text: buildNotification(order) });

  for (let attempt = 1; attempt <= ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(sendMessageUrl(token), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });

      if (response.ok) return true;

      // Текст ответа Telegram содержит причину: неверный chat_id, бот
      // не в группе и прочее. Без него разбираться не с чем.
      const reason = await response.text().catch(() => '');
      console.error(
        `Уведомление о заказе ${order.orderNo} не отправлено: HTTP ${response.status} ${reason}`
      );

      // 4xx повторять бессмысленно: тело и адрес те же, ответ не изменится.
      if (response.status < 500) return false;
    } catch (error) {
      console.error(`Уведомление о заказе ${order.orderNo}, попытка ${attempt}:`, error);
    }
  }

  return false;
}
