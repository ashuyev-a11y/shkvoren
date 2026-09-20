/**
 * Корзина и оформление — /cart.
 *
 * Страница целиком клиентская: содержимое корзины живёт в localStorage
 * и серверу до нажатия «Отправить в WhatsApp» не принадлежит.
 */
import { CartClient } from '../../components/CartClient';

export const metadata = {
  title: 'Заказ — ШКВОРЕНЬ',
};

export default function CartPage() {
  return (
    <section>
      <h1 className="t-title m-0">Ваш заказ</h1>
      <p className="t-body text-ink-muted mt-2 mb-6">
        Проверьте количество и оставьте телефон. Отправим заказ в WhatsApp.
      </p>

      <CartClient />
    </section>
  );
}
