/**
 * Корзина покупателя.
 *
 * Живёт только в браузере и сохраняется в localStorage (хэндоф §8):
 * серверного эндпоинта корзины нет, заказ появляется лишь в момент
 * POST /api/orders.
 *
 * Цены здесь — копия для показа. При оформлении сервер берёт цену из
 * таблицы по id и присланное значение игнорирует (lib/orders.ts),
 * поэтому устаревший снимок не может изменить сумму заказа.
 */
'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ArticleKind, PublicPart } from '../types/part';

/** Позиция корзины: количество плюс снимок данных для показа. */
export type CartItem = {
  id: number;
  title: string;
  article: string | null;
  articleKind: ArticleKind;
  /** Цена за штуку на момент добавления, целые тенге. */
  price: number;
  /** Сколько заказано. */
  qty: number;
  /** Сколько было на складе, когда позицию добавили. Потолок степпера. */
  stock: number;
};

type CartState = {
  items: CartItem[];
  /** Телефон покупателя — обязателен по решению 2. */
  phone: string;
  /**
   * Прочитано ли сохранённое состояние из localStorage.
   * До этого момента счётчики не показываются: серверная разметка
   * о содержимом корзины не знает, и разметка разошлась бы при гидратации.
   */
  hydrated: boolean;

  setQty: (part: PublicPart, qty: number) => void;
  remove: (id: number) => void;
  clear: () => void;
  setPhone: (phone: string) => void;
};

/** Количество, ограниченное складом: ниже нуля и выше остатка не уходим. */
function clampQty(qty: number, stock: number): number {
  if (!Number.isFinite(qty)) return 0;
  return Math.max(0, Math.min(Math.trunc(qty), stock));
}

export const useCart = create<CartState>()(
  persist(
    (set) => ({
      items: [],
      phone: '',
      hydrated: false,

      /**
       * Задать количество позиции.
       * Ноль удаляет строку — отдельная кнопка «убрать» степперу не нужна.
       */
      setQty: (part, qty) =>
        set((state) => {
          const next = clampQty(qty, part.qty);
          if (next === 0) {
            return { items: state.items.filter((item) => item.id !== part.id) };
          }

          const exists = state.items.some((item) => item.id === part.id);
          if (exists) {
            return {
              items: state.items.map((item) =>
                item.id === part.id
                  ? // Снимок обновляем целиком: цена и остаток могли измениться
                    // в таблице, пока корзина лежала в localStorage.
                    { ...item, qty: next, price: part.price, stock: part.qty }
                  : item
              ),
            };
          }

          return {
            items: [
              ...state.items,
              {
                id: part.id,
                title: part.title,
                article: part.article,
                articleKind: part.articleKind,
                price: part.price,
                qty: next,
                stock: part.qty,
              },
            ],
          };
        }),

      remove: (id) => set((state) => ({ items: state.items.filter((i) => i.id !== id) })),
      clear: () => set({ items: [] }),
      setPhone: (phone) => set({ phone }),
    }),
    {
      name: 'shkvoren-cart',
      // Флаг hydrated в localStorage не сохраняется: он описывает текущую
      // загрузку страницы, а не данные покупателя.
      partialize: (state) => ({ items: state.items, phone: state.phone }),
      onRehydrateStorage: () => (state) => {
        // Вызывается и при успехе, и при ошибке чтения. Во втором случае
        // state пуст — интерфейс всё равно должен ожить с пустой корзиной.
        useCart.setState({ hydrated: true });
        void state;
      },
    }
  )
);

/** Сколько всего штук в корзине. */
export function countItems(items: CartItem[]): number {
  return items.reduce((sum, item) => sum + item.qty, 0);
}

/** Сумма корзины в тенге. */
export function cartTotal(items: CartItem[]): number {
  return items.reduce((sum, item) => sum + item.price * item.qty, 0);
}
