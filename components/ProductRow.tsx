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
import { usePartOffer } from '../lib/offer';
import { useToast } from '../lib/toast';
import { ArticleChip } from './ArticleChip';
import { OfferPrice } from './OfferPrice';
import { Price } from './Price';
import { QuantityControl } from './QuantityControl';
import { StockBadge } from './StockBadge';
import type { PublicPart } from '../types/part';

export function ProductRow({ part }: { part: PublicPart }) {
  // Предложение цены прямо на витрине (решение 18.1) — тот же хук, что у карточки.
  const { qty, inCart, offer, changeOffer, changeQty } = usePartOffer(part);
  const show = useToast((s) => s.show);

  const outOfStock = part.qty <= 0;

  function add() {
    changeQty(Math.max(qty, 1));
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
          {/*
            prefetch={false}: каталог показывает все позиции одним списком,
            и Next.js подгружал бы карточку каждой строки, попавшей в экран, —
            сотни запросов подряд, из-за которых страница переставала отвечать.
          */}
          <Link
            href={`/product/${part.id}`}
            prefetch={false}
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
          {/*
            На десктопе обёртка — display: contents, её z-10 не действует,
            и растянутая ссылка строки перекрывала «+» и «В заказ»: клик
            открывал карточку. Поэтому слой поднят у самих элементов.
          */}
          <div className="relative z-10">
            <QuantityControl
              value={qty}
              max={part.qty}
              onChange={changeQty}
              title={part.title}
            />
          </div>

          <button
            type="button"
            onClick={add}
            disabled={outOfStock}
            className={`t-body-strong relative z-10 rounded-md px-4 ${
              inCart
                ? 'text-on-whatsapp bg-whatsapp'
                : 'bg-signal text-on-signal disabled:opacity-40'
            }`}
          >
            {inCart ? 'В заказе' : 'В заказ'}
          </button>
        </div>

        {/*
          Торг по позиции на витрине (решение 18.1): свёрнутая ссылка под строкой,
          на всю ширину. Слой выше растянутой ссылки — клик не открывает карточку.
        */}
        {!outOfStock && (
          <div
            className="relative z-10 col-span-2 md:col-span-6"
            onClick={(e) => e.stopPropagation()}
          >
            <OfferPrice
              value={offer}
              onChange={changeOffer}
              label={`Ваша цена за шт: ${part.title}`}
              linkLabel="Предложить свою цену"
              hint={
                inCart
                  ? 'Цена сохранена в заказе. Продавец подтвердит её в переписке.'
                  : 'Цена уйдёт в заказ вместе с позицией.'
              }
            />
          </div>
        )}
      </div>
    </li>
  );
}
