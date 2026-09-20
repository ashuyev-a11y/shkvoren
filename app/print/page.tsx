/**
 * Бланк заказа — /print.
 *
 * Собирается из корзины в браузере, поэтому страница клиентская.
 * Адреса вида /order/ШКВ-0002/print нет намеренно: номера последовательны,
 * и перебором открывался бы чужой заказ с телефоном покупателя.
 */
import { OrderBlank } from '../../components/OrderBlank';

export const metadata = {
  title: 'Бланк заказа — ШКВОРЕНЬ',
};

export default function PrintPage() {
  return (
    <section>
      <h1 className="t-title no-print m-0">Бланк заказа</h1>
      <p className="t-body text-ink-muted no-print mt-2 mb-6">
        Распечатайте и подойдите с ним на Салем. Заказ это не отправляет.
      </p>

      <OrderBlank />
    </section>
  );
}
