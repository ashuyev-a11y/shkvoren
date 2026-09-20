/**
 * Каталог: поиск, фильтры, список, нижняя панель заказа.
 *
 * Данные приходят с сервера уже разобранными (app/page.tsx читает таблицу
 * через getParts с кэшем 4 минуты, решение 1). В браузере остаётся только
 * фильтрация — 269 позиций, полный проход занимает доли миллисекунды.
 *
 * Поиск выполняется теми же функциями, что и на сервере (lib/search.ts):
 * фильтрация подстрокой потеряла бы раскладку, дефисы и опечатки.
 */
'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { cartTotal, countItems, useCart } from '../lib/cart';
import { formatPrice } from '../lib/format';
import { MIN_QUERY_LENGTH, searchParts } from '../lib/search';
import { EmptyState } from './EmptyState';
import { Filters, type BrandFilter } from './Filters';
import { ProductRow } from './ProductRow';
import type { PublicPart } from '../types/part';

type Props = {
  parts: PublicPart[];
  categories: { name: string; count: number }[];
};

export function CatalogClient({ parts, categories }: Props) {
  const [query, setQuery] = useState('');
  const [brand, setBrand] = useState<BrandFilter>(null);
  const [category, setCategory] = useState<string | null>(null);
  const [inStock, setInStock] = useState(false);

  const items = useCart((s) => s.items);
  const hydrated = useCart((s) => s.hydrated);

  const visible = useMemo(() => {
    let list = parts;

    if (brand !== null) list = list.filter((p) => p.brands.includes(brand));
    if (category !== null) list = list.filter((p) => p.category === category);
    if (inStock) list = list.filter((p) => p.qty > 0);

    // Поиск последним: он задаёт порядок выдачи, и фильтры не должны его ломать.
    if (query.trim().length >= MIN_QUERY_LENGTH) {
      list = searchParts(list, query, list.length);
    }

    return list;
  }, [parts, brand, category, inStock, query]);

  const count = countItems(items);
  const total = cartTotal(items);

  return (
    <>
      <Filters
        query={query}
        onQuery={setQuery}
        brand={brand}
        onBrand={setBrand}
        category={category}
        onCategory={setCategory}
        categories={categories}
        inStock={inStock}
        onInStock={setInStock}
      />

      <p className="t-small text-ink-muted mt-4 mb-0">
        {visible.length === parts.length
          ? `Позиций: ${parts.length}`
          : `Найдено: ${visible.length} из ${parts.length}`}
      </p>

      {visible.length === 0 ? (
        <div className="mt-4">
          <EmptyState
            title="Ничего не нашли"
            hint="Проверьте номер или попробуйте другое слово. Можно спросить у нас — подскажем по применимости."
            action={
              <button
                type="button"
                onClick={() => {
                  setQuery('');
                  setBrand(null);
                  setCategory(null);
                  setInStock(false);
                }}
                className="t-body-strong bg-signal text-on-signal rounded-md px-6"
              >
                Сбросить фильтры
              </button>
            }
          />
        </div>
      ) : (
        <ul className="border-line mt-4 list-none rounded-md border p-0">
          {visible.map((part) => (
            <ProductRow key={part.id} part={part} />
          ))}
        </ul>
      )}

      {/*
        Нижняя панель заказа. Появляется только когда в корзине что-то есть,
        и только после чтения localStorage: иначе разметка сервера и браузера
        разошлись бы при гидратации.
      */}
      {hydrated && count > 0 && (
        <div className="bg-graphite text-on-graphite sticky bottom-0 z-20 -mx-4 mt-6 px-4 py-3 shadow-[var(--shadow-sm)] md:-mx-8 md:px-8">
          <div className="mx-auto flex max-w-[1280px] items-center justify-between gap-4">
            <span className="t-body" style={{ fontVariantNumeric: 'tabular-nums' }}>
              {count} шт на {formatPrice(total)}
            </span>

            <Link
              href="/cart"
              className="t-body-strong bg-signal text-on-signal inline-flex items-center rounded-md px-6 py-3"
            >
              Оформить заказ
            </Link>
          </div>
        </div>
      )}
    </>
  );
}
