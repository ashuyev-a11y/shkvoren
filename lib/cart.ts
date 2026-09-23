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
import { COMMENT_MAX } from './orders.ts';
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
  /**
   * Цена за штуку, предложенная покупателем (решение 18). null — торга нет.
   * Хранится рядом с прайсовой, а не вместо неё: продавец должен видеть обе.
   */
  offeredPrice: number | null;
};

type CartState = {
  items: CartItem[];
  /** Телефон покупателя — обязателен по решению 2. */
  phone: string;
  /**
   * Сумма за весь заказ, предложенная покупателем (решение 18).
   * null — торга за заказ нет, итог считается по строкам.
   */
  offeredTotal: number | null;
  /** Комментарий к заказу (решение 18.1). Пустая строка — комментария нет. */
  comment: string;
  /**
   * Прочитано ли сохранённое состояние из localStorage.
   * До этого момента счётчики не показываются: серверная разметка
   * о содержимом корзины не знает, и разметка разошлась бы при гидратации.
   */
  hydrated: boolean;

  /**
   * Задать количество позиции. Третий аргумент — предложенная цена
   * (решение 18.1): карточка товара передаёт её при добавлении. undefined —
   * не трогать уже сделанное предложение, null — снять его.
   */
  setQty: (part: PublicPart, qty: number, offeredPrice?: number | null) => void;
  remove: (id: number) => void;
  clear: () => void;
  setPhone: (phone: string) => void;
  /** Задать или снять (null) предложение по позиции. */
  setOfferedPrice: (id: number, price: number | null) => void;
  /** Задать или снять (null) предложение за весь заказ. */
  setOfferedTotal: (total: number | null) => void;
  /** Задать комментарий к заказу. Длина обрезается до COMMENT_MAX. */
  setComment: (comment: string) => void;
};

// Предел длины комментария один на клиент и сервер: объявлен в lib/orders.ts
// (решение 18.1), здесь переэкспортируется для поля ввода.
export { COMMENT_MAX };

/**
 * Привести предложение покупателя к виду, пригодному для отправки.
 *
 * Всё, что не целое число больше нуля, считается снятым предложением:
 * пустое поле, минус, дробь и мусор из вставки буфера обмена ведут себя
 * одинаково — торга нет. Валидация по решению 18 только такая: отсечек
 * «не ниже прайса» нет, цена в таблице и так себестоимость.
 */
function normalizeOffer(value: number | null): number | null {
  if (value === null || !Number.isFinite(value)) return null;
  const whole = Math.trunc(value);
  return whole > 0 ? whole : null;
}

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
      offeredTotal: null,
      comment: '',
      hydrated: false,

      /**
       * Задать количество позиции.
       * Ноль удаляет строку — отдельная кнопка «убрать» степперу не нужна.
       */
      setQty: (part, qty, offeredPrice) =>
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
                    // Предложение покупателя сохраняется: оно принадлежит ему,
                    // а не таблице, и сбрасывать его при изменении количества
                    // значило бы молча отменить торг.
                    {
                      ...item,
                      qty: next,
                      price: part.price,
                      stock: part.qty,
                      // Явно переданное предложение заменяет прежнее.
                      ...(offeredPrice === undefined
                        ? {}
                        : { offeredPrice: normalizeOffer(offeredPrice) }),
                    }
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
                // По прайсу, если покупатель не предложил цену на карточке.
                offeredPrice: normalizeOffer(offeredPrice ?? null),
              },
            ],
          };
        }),

      remove: (id) => set((state) => ({ items: state.items.filter((i) => i.id !== id) })),
      // Предложение за заказ снимается вместе с корзиной: сумма за «весь
      // заказ» без самого заказа смысла не имеет.
      clear: () => set({ items: [], offeredTotal: null, comment: '' }),
      setPhone: (phone) => set({ phone }),

      setOfferedPrice: (id, price) =>
        set((state) => ({
          items: state.items.map((item) =>
            item.id === id ? { ...item, offeredPrice: normalizeOffer(price) } : item
          ),
        })),

      setOfferedTotal: (total) => set({ offeredTotal: normalizeOffer(total) }),

      setComment: (comment) => set({ comment: comment.slice(0, COMMENT_MAX) }),
    }),
    {
      name: 'shkvoren-cart',
      // Флаг hydrated в localStorage не сохраняется: он описывает текущую
      // загрузку страницы, а не данные покупателя.
      partialize: (state) => ({
        items: state.items,
        phone: state.phone,
        offeredTotal: state.offeredTotal,
        comment: state.comment,
      }),
      onRehydrateStorage: () => (state) => {
        // Флаг ставится мутацией переданного состояния, а не useCart.setState:
        // колбэк выполняется до слияния, и записанное через setState значение
        // затирается — интерфейс навсегда замирал на «Загружаем заказ…».
        if (state) {
          state.hydrated = true;
          return;
        }

        // Сюда попадаем при ошибке чтения: битый JSON в localStorage или
        // закрытое хранилище в приватном окне. Корзины нет, но интерфейс
        // обязан ожить с пустой — иначе страница заказа не откроется совсем.
        // Вызов откладывается: переменная useCart к этому моменту ещё
        // не присвоена, колбэк работает внутри create().
        queueMicrotask(() => useCart.setState({ hydrated: true }));
      },
    }
  )
);

/** Сколько всего штук в корзине. */
export function countItems(items: CartItem[]): number {
  return items.reduce((sum, item) => sum + item.qty, 0);
}

/** Сумма корзины по ценам прайса, без учёта торга. */
export function cartTotal(items: CartItem[]): number {
  return items.reduce((sum, item) => sum + item.price * item.qty, 0);
}

/**
 * Действующая цена позиции: предложенная, если она есть (решение 18).
 * Поля может не быть у корзины, сохранённой до появления торга,
 * поэтому приводим к null, а не читаем напрямую.
 */
export function itemPrice(item: CartItem): number {
  return item.offeredPrice ?? item.price;
}

/** Сумма корзины с учётом построчных предложений. */
export function offeredLinesTotal(items: CartItem[]): number {
  return items.reduce((sum, item) => sum + itemPrice(item) * item.qty, 0);
}

/**
 * Итог, который покупатель предлагает заплатить (решение 18).
 *
 * Сумма за весь заказ перекрывает построчные предложения: если торгуются
 * за партию целиком, одна цифра отменяет разбивку по позициям.
 */
export function effectiveCartTotal(items: CartItem[], offeredTotal: number | null): number {
  return offeredTotal ?? offeredLinesTotal(items);
}
