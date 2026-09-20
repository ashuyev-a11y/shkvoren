/**
 * Строка каталога — хэндоф §2 и §6.
 *
 * Сетка: на десктопе шесть колонок (название · категория · цена · остаток ·
 * степпер · кнопка), на узком экране колонка категории скрывается, остальное
 * переносится в компактный блок.
 *
 * Клик по строке открывает карточку. Степпер и кнопка гасят всплытие —
 * иначе изменение количества уводило бы со страницы.
 */
'use client';

import Link from 'next/link';
import { useCart } from '../lib/cart';
import { useToast } from '../lib/toast';
import { ArticleChip } from './ArticleChip';
import { Price } from './Price';
import { QuantityControl } from './QuantityControl';
import { StockBadge } from './StockBadge';
import type { PublicPart } from '../types/part';

export function ProductRow({ part }: { part: PublicPart }) {
  const qty = useCart((s) => s.items.find((i) => i.id === part.id)?.qty ?? 0);
  const setQty = useCart((s) => s.setQty);
  const show = useToast((s) => s.show);

  const outOfStock = part.qty <= 0;
  const inCart = qty > 0;

  function add() {
    setQty(part, Math.max(qty, 1));
    show('Добавлено в заказ');
  }

  return (
    <li className="border-line bg-surface-raised hover:bg-surface-sunken relative border-b last:border-b-0">
      <div className="grid grid-cols-2 items-center gap-3 px-4 py-3 md:grid-cols-[1fr_auto_auto_auto_auto_auto] md:gap-4">
        {/* Название, номер и применимость */}
        <div className="col-span-2 min-w-0 md:col-span-1">
          {/*
            Ссылка растянута на всю строку псевдоэлементом: так вся карточка
            кликабельна, но в разметке остаётся обычный <a>, доступный с
            клавиатуры. Интерактивные элементы ниже лежат выше по z-index.
          */}
          <Link
            href={`/product/${part.id}`}
            className="t-body-strong before:absolute before:inset-0 before:content-['']"
          >
            {part.title}
          </Link>

          <div className="relative z-10 mt-1 flex flex-wrap items-center gap-x-4 gap-y-1">
            <ArticleChip article={part.article} articleKind={part.articleKind} />
            {part.fitment !== null && (
              <span className="t-small text-ink-muted">{part.fitment}</span>
            )}
          </div>
        </div>

        {/* Категория — на узком экране скрыта (хэндоф §6) */}
        <span className="t-small text-ink-muted hidden md:inline">{part.category}</span>

        <Price value={part.price} />

        <StockBadge qty={part.qty} />

        {/* Степпер и кнопка: выше ссылки по слою, клик по ним не открывает карточку */}
        <div
          className="relative z-10 col-span-2 flex items-center justify-between gap-3 md:col-span-1 md:contents"
          onClick={(e) => e.stopPropagation()}
        >
          <QuantityControl
            value={qty}
            max={part.qty}
            onChange={(next) => setQty(part, next)}
            title={part.title}
          />

          <button
            type="button"
            onClick={add}
            disabled={outOfStock}
            className={`t-body-strong rounded-md px-4 ${
              inCart
                ? 'text-on-whatsapp bg-whatsapp'
                : 'bg-signal text-on-signal disabled:opacity-40'
            }`}
          >
            {inCart ? 'В заказе' : 'В заказ'}
          </button>
        </div>
      </div>
    </li>
  );
}
