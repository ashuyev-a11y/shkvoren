/**
 * Кнопка заказа в шапке со счётчиком позиций — хэндоф §2.
 *
 * До чтения localStorage счётчик не рисуется: серверная разметка о корзине
 * не знает, и число «прыгнуло» бы при гидратации.
 */
'use client';

import Link from 'next/link';
import { countItems, useCart } from '../lib/cart';

export function CartButton() {
  const items = useCart((s) => s.items);
  const hydrated = useCart((s) => s.hydrated);
  const count = countItems(items);

  return (
    <Link
      href="/cart"
      className="t-body relative inline-flex items-center gap-2 rounded-md px-3 py-2"
    >
      Заказ
      {hydrated && count > 0 && (
        <span
          className="bg-signal text-on-signal t-caption inline-flex min-w-6 justify-center rounded-full px-2 py-1"
          aria-label={`Позиций в заказе: ${count}`}
        >
          {count}
        </span>
      )}
    </Link>
  );
}
