/**
 * POST /api/orders — создание заказа.
 *
 * Контракт: docs/technical-spec.md §6, порядок операций — решение 2:
 * сначала строка дописывается в лист «Заказы», и только потом покупателю
 * возвращается ссылка на WhatsApp. Заказ, не записанный в таблицу,
 * не существует.
 */
import { NextResponse, after } from 'next/server';
import { z } from 'zod';
import { getParts } from '@/lib/catalog';
import { isValidPhone } from '@/lib/format';
import { OrderError, buildLines } from '@/lib/orders';
import { createOrder } from '@/lib/orders-write';
import { SheetsError } from '@/lib/sheets';
import { notifyNewOrder } from '@/lib/telegram';
import { buildWhatsappUrl } from '@/lib/whatsapp';

/**
 * Тело запроса. Цены в нём нет намеренно: сервер берёт её по id из таблицы,
 * присланное браузером значение игнорируется.
 */
const Body = z.object({
  // Телефон обязателен: без него в логе заказа нет контакта (решение 2).
  phone: z.string().refine(isValidPhone, 'Укажите телефон — без него мы не сможем с вами связаться.'),
  items: z
    .array(
      z.object({
        id: z.number().int().positive(),
        qty: z.number().int().positive(),
        /*
         * Цена, предложенная покупателем (решение 18). Единственная цена,
         * которую сервер принимает от браузера: прайсовую он всё равно
         * берёт из таблицы, а эта не заменяет её, а сохраняется рядом.
         * Проверка только базовая — целое больше нуля, отсечек по проценту
         * от прайса нет: цена в таблице и так себестоимость (решение 0).
         */
        offeredPrice: z
          .number()
          .int('Предложенная цена должна быть целым числом.')
          .positive('Предложенная цена должна быть больше нуля.')
          .nullish(),
      })
    )
    .min(1, 'Добавьте хотя бы одну позицию.')
    .max(100),
  offeredTotal: z
    .number()
    .int('Предложенная сумма должна быть целым числом.')
    .positive('Предложенная сумма должна быть больше нуля.')
    .nullish(),
  /*
   * Комментарий к заказу (решение 18.1). Строгой валидации нет: длинный
   * текст не отклоняет заказ, а обрезается до COMMENT_MAX в normalizeComment.
   */
  comment: z.string().nullish(),
});

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'Не удалось прочитать заказ.' }, { status: 400 });
  }

  const parsed = Body.safeParse(payload);
  if (!parsed.success) {
    // Показываем первую причину: список из десяти претензий покупателю не нужен.
    const reason = parsed.error.issues[0]?.message ?? 'Проверьте данные заказа.';
    return NextResponse.json({ error: reason }, { status: 400 });
  }

  try {
    const read = await getParts();
    const lines = buildLines(parsed.data.items, read.parts);

    // Порядок важен: запись — раньше ссылки.
    const order = await createOrder(
      lines,
      parsed.data.phone,
      parsed.data.offeredTotal ?? null,
      parsed.data.comment ?? null
    );

    /*
     * Уведомление продавца (решение 17). after() выполняет работу после
     * ответа покупателю: он не ждёт Telegram, а функция при этом не
     * обрывается на середине, как оборвался бы просто не дождавшийся
     * промис в serverless-окружении.
     *
     * Ошибки notifyNewOrder не выбрасывает: заказ уже в листе, и падение
     * дополнительного канала не должно показываться покупателю как отказ.
     */
    after(() => notifyNewOrder(order));

    return NextResponse.json({
      orderNo: order.orderNo,
      total: order.total,
      // Комментарий берётся из заказа — уже нормализованный, тот же, что в листе.
      whatsappUrl: buildWhatsappUrl(
        order.lines,
        order.phone,
        order.offeredTotal,
        order.comment ?? ''
      ),
    });
  } catch (error) {
    // Ошибка состава заказа — вина данных запроса, текст можно показать.
    if (error instanceof OrderError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    console.error('Заказ не записан:', error);

    if (error instanceof SheetsError) {
      // 502: наша сторона исправна, не ответила Google. Ссылки в ответе нет.
      return NextResponse.json(
        { error: 'Не удалось сохранить заказ. Позвоните нам или попробуйте ещё раз.' },
        { status: 502 }
      );
    }

    return NextResponse.json({ error: 'Не удалось оформить заказ.' }, { status: 500 });
  }
}
