/**
 * Подтверждение заказа — /order/done?no=ШКВ-0001.
 *
 * Номер приходит параметром адреса, а не читается из листа: страница по
 * адресу /order/ШКВ-0002 открывала бы чужой заказ вместе с телефоном
 * покупателя, потому что номера последовательны. Здесь показывается только
 * то, что покупатель и так видел на экране.
 */
import Link from 'next/link';
import { OrderDone } from '../../../components/OrderDone';

export const metadata = {
  title: 'Заказ отправлен — ШКВОРЕНЬ',
};

export default async function OrderDonePage({
  searchParams,
}: {
  searchParams: Promise<{ no?: string }>;
}) {
  const { no } = await searchParams;

  // Прямой заход без номера — заказа не было, отправлять покупателя некуда,
  // кроме каталога.
  if (typeof no !== 'string' || no.trim() === '') {
    return (
      <section className="mx-auto max-w-[520px] text-center">
        <h1 className="t-title m-0">Заказа здесь нет</h1>
        <p className="t-body text-ink-muted mt-2 mb-6">
          Похоже, вы открыли страницу напрямую. Соберите заказ в каталоге.
        </p>
        <Link
          href="/"
          className="t-body-strong bg-signal text-on-signal inline-flex items-center rounded-md px-6 py-3"
        >
          Открыть каталог
        </Link>
      </section>
    );
  }

  return <OrderDone orderNo={no} />;
}
