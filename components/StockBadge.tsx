/**
 * Бейдж остатка — хэндоф §2.
 *
 * Три состояния: много (зелёный), мало (янтарный), нет в наличии (серый).
 * Точное число показывается всегда, когда товар есть: опту нужно решение
 * по объёму, а не факт наличия (решение 8).
 *
 * Порог «мало» вынесен в константу: на текущих данных остаток 1..5 имеют
 * 165 позиций из 269, и значение почти наверняка придётся менять.
 */
import { formatQty } from '../lib/format';

/** Остаток, начиная с которого позиция считается заканчивающейся. */
export const LOW_STOCK = 5;

export function StockBadge({ qty }: { qty: number }) {
  if (qty <= 0) {
    return (
      <span className="t-small bg-surface-sunken text-ink-muted inline-block rounded-sm px-2 py-1">
        нет в наличии
      </span>
    );
  }

  const low = qty <= LOW_STOCK;

  return (
    <span
      className={`t-small inline-block rounded-sm px-2 py-1 ${
        low ? 'bg-signal-soft text-signal-ink' : 'text-on-graphite bg-stock'
      }`}
      style={{ fontVariantNumeric: 'tabular-nums' }}
    >
      {formatQty(qty)}
    </span>
  );
}
