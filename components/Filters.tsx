/**
 * Панель фильтров каталога — хэндоф §2 и §4.
 *
 * Липкая сверху на обоих разрешениях. Фильтрация мгновенная, без состояния
 * загрузки: каталог целиком уже в памяти браузера (269 позиций).
 */
'use client';

import type { Brand } from '../types/part';

/** Значение фильтра марки. null — все марки. */
export type BrandFilter = Brand | null;

type Props = {
  query: string;
  onQuery: (value: string) => void;
  brand: BrandFilter;
  onBrand: (value: BrandFilter) => void;
  category: string | null;
  onCategory: (value: string | null) => void;
  categories: { name: string; count: number }[];
  inStock: boolean;
  onInStock: (value: boolean) => void;
};

/** Кнопка сегментированного переключателя марки. */
function BrandButton({
  active,
  onClick,
  children,
  tone,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  tone: 'graphite' | 'gaz' | 'uaz';
}) {
  const fill =
    tone === 'gaz' ? 'bg-gaz text-on-graphite' : tone === 'uaz' ? 'bg-uaz text-on-graphite' : 'bg-graphite text-on-graphite';

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`t-body px-4 ${active ? fill : 'text-ink'}`}
    >
      {children}
    </button>
  );
}

export function Filters(props: Props) {
  const { query, onQuery, brand, onBrand, category, onCategory, categories, inStock, onInStock } =
    props;

  return (
    <div className="bg-surface border-line sticky top-0 z-20 border-b py-3">
      <div className="flex flex-wrap items-center gap-3">
        {/* Поиск */}
        <div className="border-control-border bg-surface-raised flex min-w-0 flex-1 items-center gap-2 rounded-md border px-3">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
            <circle cx="8" cy="8" r="5.5" stroke="currentColor" />
            <path d="m12.5 12.5 3 3" stroke="currentColor" strokeLinecap="round" />
          </svg>

          <input
            type="search"
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            placeholder="Номер или название"
            aria-label="Поиск по каталогу"
            className="t-body min-w-0 flex-1 bg-transparent outline-none"
          />

          {query !== '' && (
            <button
              type="button"
              onClick={() => onQuery('')}
              aria-label="Очистить поиск"
              className="text-ink-muted hover:text-ink min-h-0 p-1"
            >
              ×
            </button>
          )}
        </div>

        {/* Марка */}
        <div className="border-control-border flex overflow-hidden rounded-md border">
          <BrandButton active={brand === null} onClick={() => onBrand(null)} tone="graphite">
            Все
          </BrandButton>
          <BrandButton active={brand === 'ГАЗ'} onClick={() => onBrand('ГАЗ')} tone="gaz">
            ГАЗ
          </BrandButton>
          <BrandButton active={brand === 'УАЗ'} onClick={() => onBrand('УАЗ')} tone="uaz">
            УАЗ
          </BrandButton>
        </div>

        {/* Только в наличии */}
        <label className="t-body flex items-center gap-2">
          <input
            type="checkbox"
            checked={inStock}
            onChange={(e) => onInStock(e.target.checked)}
            className="accent-[var(--signal)]"
          />
          Только в наличии
        </label>
      </div>

      {/* Категории */}
      <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
        <button
          type="button"
          onClick={() => onCategory(null)}
          aria-pressed={category === null}
          className={`t-small shrink-0 rounded-full px-4 py-2 ${
            category === null ? 'bg-graphite text-on-graphite' : 'border-line bg-surface-raised border'
          }`}
        >
          Все категории
        </button>

        {categories.map((item) => (
          <button
            key={item.name}
            type="button"
            onClick={() => onCategory(item.name)}
            aria-pressed={category === item.name}
            className={`t-small shrink-0 rounded-full px-4 py-2 ${
              category === item.name
                ? 'bg-graphite text-on-graphite'
                : 'border-line bg-surface-raised border'
            }`}
          >
            {item.name} {item.count}
          </button>
        ))}
      </div>
    </div>
  );
}
