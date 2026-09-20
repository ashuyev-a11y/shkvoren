/**
 * Каталожный номер позиции — хэндоф §2, решение 11.
 *
 * Три случая, потому что в колонке «Артикул» лежит не только номер:
 *   'number' — каталожный номер, копируется;
 *   'size'   — размер сальника или подшипника (20 позиций из 269),
 *              подписывается как размер: копировать его как номер
 *              и слать продавцу — значит ввести механика в заблуждение;
 *   'none'   — номера нет (91 позиция), показываем это явно,
 *              а не оставляем пустое место.
 */
'use client';

import { useToast } from '../lib/toast';
import type { ArticleKind } from '../types/part';

/** Иконка копирования. Отдельного пакета иконок в проекте нет. */
function CopyIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="5.5" y="5.5" width="8" height="8" rx="1.5" stroke="currentColor" />
      <path d="M10.5 3.5H3.5a1 1 0 0 0-1 1v7" stroke="currentColor" strokeLinecap="round" />
    </svg>
  );
}

type Props = {
  article: string | null;
  articleKind: ArticleKind;
  /** Крупное начертание для карточки позиции. */
  large?: boolean;
};

export function ArticleChip({ article, articleKind, large = false }: Props) {
  const show = useToast((s) => s.show);

  if (article === null || articleKind === 'none') {
    return <span className="t-small text-ink-muted">номер не указан</span>;
  }

  const isSize = articleKind === 'size';

  async function copy() {
    if (article === null) return;
    try {
      await navigator.clipboard.writeText(article);
      show(isSize ? 'Размер скопирован' : 'Артикул скопирован');
    } catch {
      // Доступ к буферу обмена может быть закрыт настройками браузера.
      // Текст выделяем сами — .part-number объявлен с user-select: all.
      show('Скопировать не удалось. Выделите номер вручную.');
    }
  }

  return (
    <span className="inline-flex items-center gap-2">
      <span className={`part-number ${large ? 't-part-number-lg' : 't-part-number'}`}>
        {article}
      </span>

      {isSize && <span className="t-small text-ink-muted">размер</span>}

      <button
        type="button"
        onClick={copy}
        aria-label={isSize ? `Скопировать размер ${article}` : `Скопировать артикул ${article}`}
        className="text-ink-muted hover:text-ink inline-flex min-h-0 items-center rounded-sm p-1"
      >
        <CopyIcon />
      </button>
    </span>
  );
}
