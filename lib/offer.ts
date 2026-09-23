/**
 * Предложение цены по позиции вне корзины — решение 18.1.
 *
 * Общий хук для строки каталога и карточки товара: оба места ведут себя
 * одинаково. Пока позиции нет в корзине, строки корзины ещё нет, и цену
 * хранить негде, кроме самого экрана, — она живёт в локальном состоянии и
 * уходит в корзину вместе с позицией. После добавления цена правится прямо
 * в позиции корзины, так что каталог, карточка и корзина видят одно значение.
 */
'use client';

import { useState } from 'react';
import { useCart } from './cart';
import type { PublicPart } from '../types/part';

export function usePartOffer(part: PublicPart) {
  const qty = useCart((s) => s.items.find((i) => i.id === part.id)?.qty ?? 0);
  const cartOffer = useCart(
    (s) => s.items.find((i) => i.id === part.id)?.offeredPrice ?? null
  );
  const setQty = useCart((s) => s.setQty);
  const setOfferedPrice = useCart((s) => s.setOfferedPrice);

  const inCart = qty > 0;
  const [pendingOffer, setPendingOffer] = useState<number | null>(null);

  /** Действующее предложение: из корзины, если позиция уже там. */
  const offer = inCart ? cartOffer : pendingOffer;

  function changeOffer(next: number | null) {
    if (inCart) setOfferedPrice(part.id, next);
    else setPendingOffer(next);
  }

  /** Изменить количество; при первом добавлении забрать предложенную цену. */
  function changeQty(next: number) {
    setQty(part, next, inCart ? undefined : pendingOffer);
  }

  return { qty, inCart, offer, changeOffer, changeQty };
}
