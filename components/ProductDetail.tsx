/**
 * Карточка позиции — хэндоф §1 и §2.
 *
 * Одна колонка: фото в MVP нет ни у одной позиции (решение 15), и колонка
 * под пустой слот только растягивала бы экран. Кросс-номера не показываются:
 * такой колонки в таблице нет, а выдумывать номера запрещено (AGENTS.md).
 */
'use client';

import Link from 'next/link';
import { useCart } from '../lib/cart';
import { useToast } from '../lib/toast';
import { buildWhatsappUrl } from '../lib/whatsapp';
import { ArticleChip } from './ArticleChip';
import { Price } from './Price';
import { QuantityControl } from './QuantityControl';
import { StockBadge } from './StockBadge';
import type { PublicPart } from '../types/part';

export function ProductDetail({ part }: { part: PublicPart }) {
  const qty = useCart((s) => s.items.find((i) => i.id === part.id)?.qty ?? 0);
  const setQty = useCart((s) => s.setQty);
  const phone = useCart((s) => s.phone);
  const show = useToast((s) => s.show);

  const inCart = qty > 0;

  function add() {
    setQty(part, Math.max(qty, 1));
    show('Добавлено в заказ');
  }

  /**
   * Вопрос о применимости уходит тем же путём, что и заказ, но без позиций:
   * шаблон решения 12 для пустой корзины. Телефон подставляется, только если
   * покупатель уже вводил его в этой сессии.
   */
  function ask() {
    try {
      window.open(buildWhatsappUrl([], phone), '_blank', 'noopener');
    } catch {
      show('Не удалось открыть WhatsApp. Напишите нам сами.');
    }
  }

  return (
    <article>
      <Link href="/" className="t-small text-ink-muted inline-block">
        ← К каталогу
      </Link>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {part.brands.map((brand) => (
          <span
            key={brand}
            className={`t-caption rounded-sm px-2 py-1 ${
              brand === 'ГАЗ' ? 'bg-gaz-soft text-gaz' : 'bg-uaz-soft text-uaz'
            }`}
          >
            {brand}
          </span>
        ))}
        <span className="t-caption bg-surface-sunken text-ink-muted rounded-sm px-2 py-1">
          {part.category}
        </span>
      </div>

      <h1 className="t-title mt-3 mb-0">{part.title}</h1>

      <div className="mt-4">
        <ArticleChip article={part.article} articleKind={part.articleKind} large />
      </div>

      {/* Применимость — строка из таблицы как есть, без разбора (решение 10) */}
      <div className="border-line bg-surface-raised mt-6 rounded-md border px-4 py-3">
        <p className="t-caption text-ink-muted m-0">Подходит к</p>
        <p className="t-body mt-1 mb-0">
          {part.fitment ?? 'Уточните у нас — подскажем по применимости.'}
        </p>
      </div>

      <div className="border-line bg-surface-raised mt-4 rounded-md border px-4 py-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Price value={part.price} large />
          <StockBadge qty={part.qty} />
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <QuantityControl
            value={qty}
            max={part.qty}
            onChange={(next) => setQty(part, next)}
            title={part.title}
          />

          <button
            type="button"
            onClick={add}
            disabled={part.qty <= 0}
            className={`t-body-strong rounded-md px-6 ${
              inCart ? 'text-on-whatsapp bg-whatsapp' : 'bg-signal text-on-signal disabled:opacity-40'
            }`}
          >
            {inCart ? 'В заказе' : 'В заказ'}
          </button>

          {inCart && (
            <Link
              href="/cart"
              className="t-body-strong border-control-border inline-flex items-center rounded-md border px-6 py-3"
            >
              Оформить
            </Link>
          )}
        </div>

        <button
          type="button"
          onClick={ask}
          className="t-body text-gaz mt-4 block px-0 underline"
        >
          Уточнить, подойдёт ли
        </button>
      </div>
    </article>
  );
}
