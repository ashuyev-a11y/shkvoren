/**
 * Карточка «заказ отправлен» — хэндоф §1.
 *
 * Заказ уже записан в лист «Заказы» (решение 2), корзина очищена.
 * Здесь остаётся только номер и объяснение, что будет дальше.
 */
import Link from 'next/link';

export function OrderDone({ orderNo }: { orderNo: string }) {
  return (
    <section className="border-line bg-surface-raised mx-auto max-w-[520px] rounded-md border px-6 py-8 text-center">
      <h1 className="t-title m-0">Заказ отправлен</h1>

      <p className="t-part-number-lg part-number mt-4 mb-0">{orderNo}</p>

      <p className="t-body text-ink-muted mt-4 mb-0">
        Мы получили заказ и перезвоним, чтобы подтвердить наличие и время.
        Если WhatsApp не открылся, напишите нам сами — номер заказа назовите
        при обращении.
      </p>

      <p className="t-body mt-6 mb-0">Забрать — на Салеме, оплата на месте.</p>

      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Link
          href="/"
          className="t-body-strong bg-signal text-on-signal inline-flex items-center rounded-md px-6 py-3"
        >
          В каталог
        </Link>
      </div>
    </section>
  );
}
