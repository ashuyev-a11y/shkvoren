/**
 * Цена — хэндоф §2.
 *
 * Формат берётся из lib/format.ts (узкий неразрывный пробел + ₸), а не из
 * toLocaleString: результат последнего зависит от сборки ICU и на сервере
 * с браузером может разойтись.
 *
 * Рыночная цена здесь не показывается: поле marketPrice не входит
 * в публичный срез (решение 5, docs/data-model.md §9).
 */
import { formatPrice } from '../lib/format';

export function Price({ value, large = false }: { value: number; large?: boolean }) {
  return (
    <span className={large ? 't-price' : 't-body-strong'} style={{ fontVariantNumeric: 'tabular-nums' }}>
      {formatPrice(value)}
    </span>
  );
}
