/**
 * Админка: таблица каталога, проблемы чтения и кнопка «Обновить сейчас».
 *
 * Только просмотр (решение 1): правка идёт в Google-таблице. Колонка «Рынок»
 * показывает marketPrice и marketDelta как есть — они заполнены у двух позиций
 * из 269, остальные ячейки пустые. Подставлять туда расчётные значения нельзя:
 * это данные будущего агента цен, а не наши вычисления.
 *
 * Служебные поля (закупка, рынок, заметки) доступны только здесь — страница
 * закрыта сессией, в публичный срез PublicPart они не входят (решение 5).
 */
'use client';

import { useMemo, useState } from 'react';
import { formatNumber, formatPrice } from '../lib/format';
import { MIN_QUERY_LENGTH, searchParts } from '../lib/search';
import type { AdminPart, SheetIssue } from '../types/part';

/** Момент последнего чтения таблицы в местном виде: 20.09.2026, 14:31. */
function readAtLabel(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;

  const pad = (value: number) => String(value).padStart(2, '0');
  return (
    `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()}, ` +
    `${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}

type Props = {
  parts: AdminPart[];
  issues: SheetIssue[];
  readAt: string;
};

export function AdminCatalog({ parts, issues, readAt }: Props) {
  const [query, setQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);

  const visible = useMemo(() => {
    if (query.trim().length < MIN_QUERY_LENGTH) return parts;
    return searchParts(parts, query, parts.length);
  }, [parts, query]);

  const units = parts.reduce((sum, part) => sum + part.qty, 0);
  const stock = parts.reduce((sum, part) => sum + part.qty * part.price, 0);

  async function refresh() {
    setRefreshError(null);
    setRefreshing(true);

    try {
      const response = await fetch('/api/admin/refresh', { method: 'POST' });
      if (!response.ok) {
        const data = await response.json();
        setRefreshError(data.error ?? 'Обновить не удалось.');
        return;
      }
      // Кэш сброшен на сервере. Перезагружаем страницу целиком: серверный
      // компонент перечитает таблицу и отдаст свежие числа.
      window.location.reload();
    } catch {
      setRefreshError('Связь прервалась. Попробуйте ещё раз.');
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="t-title m-0">Каталог</h1>

        <div className="text-right">
          <button
            type="button"
            onClick={refresh}
            disabled={refreshing}
            className="t-body-strong bg-signal text-on-signal rounded-md px-6 disabled:opacity-60"
          >
            {refreshing ? 'Обновляем…' : 'Обновить сейчас'}
          </button>
          <p className="t-small text-ink-muted mt-1 mb-0">
            Прочитано: {readAtLabel(readAt)}
          </p>
        </div>
      </div>

      {refreshError !== null && (
        <p role="alert" className="t-small text-danger mt-2 mb-0">
          {refreshError}
        </p>
      )}

      {/* Контрольные суммы: оператор сверяет их с листом «Сводка» */}
      <div className="border-line bg-surface-raised mt-6 flex flex-wrap gap-8 rounded-md border px-4 py-3">
        <p className="t-body m-0">
          Позиций: <span style={{ fontVariantNumeric: 'tabular-nums' }}>{parts.length}</span>
        </p>
        <p className="t-body m-0">
          Остаток: <span style={{ fontVariantNumeric: 'tabular-nums' }}>{formatNumber(units)} шт</span>
        </p>
        <p className="t-body m-0">
          Склад: <span style={{ fontVariantNumeric: 'tabular-nums' }}>{formatPrice(stock)}</span>
        </p>
      </div>

      {/* Проблемы чтения: скрывать их нельзя — позиция молча пропала бы с витрины */}
      {issues.length > 0 && (
        <div className="border-line bg-surface-raised mt-4 rounded-md border px-4 py-3">
          <p className="t-body-strong m-0">Проблемы в таблице: {issues.length}</p>
          <ul className="mt-2 mb-0 list-none p-0">
            {issues.map((issue, index) => (
              <li key={`${issue.row}-${index}`} className="t-small mt-1">
                <span className={issue.level === 'error' ? 'text-danger' : 'text-signal-ink'}>
                  {issue.level === 'error' ? 'Не показано' : 'Проверьте'}
                </span>
                {issue.row > 0 ? ` · строка ${issue.row}` : ' · лист целиком'} — {issue.reason}
              </li>
            ))}
          </ul>
        </div>
      )}

      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Номер или название"
        aria-label="Поиск по каталогу"
        className="t-body border-control-border bg-surface-raised mt-6 w-full rounded-md border px-3"
      />

      <p className="t-small text-ink-muted mt-2 mb-0">
        {visible.length === parts.length
          ? `Показаны все ${parts.length}`
          : `Найдено: ${visible.length} из ${parts.length}`}
      </p>

      <div className="border-line mt-2 overflow-x-auto rounded-md border">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-line bg-surface-sunken border-b">
              <th className="t-caption text-ink-muted px-3 py-2 text-left">Строка</th>
              <th className="t-caption text-ink-muted px-3 py-2 text-left">ID</th>
              <th className="t-caption text-ink-muted px-3 py-2 text-left">Номер</th>
              <th className="t-caption text-ink-muted px-3 py-2 text-left">Наименование</th>
              <th className="t-caption text-ink-muted px-3 py-2 text-left">Применимость</th>
              <th className="t-caption text-ink-muted px-3 py-2 text-right">Цена</th>
              <th className="t-caption text-ink-muted px-3 py-2 text-right">Остаток</th>
              <th className="t-caption text-ink-muted px-3 py-2 text-right">Рынок</th>
            </tr>
          </thead>

          <tbody>
            {visible.map((part) => (
              <tr key={part.id} className="border-line bg-surface-raised border-b last:border-b-0">
                <td
                  className="t-small text-ink-muted px-3 py-2"
                  style={{ fontVariantNumeric: 'tabular-nums' }}
                >
                  {part.row}
                </td>
                <td className="t-small px-3 py-2" style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {part.id}
                </td>
                <td className="t-part-number part-number px-3 py-2">
                  {part.articleKind === 'none' ? (
                    <span className="t-small text-danger">нет номера</span>
                  ) : (
                    <>
                      {part.article}
                      {part.articleKind === 'size' && (
                        <span className="t-small text-ink-muted"> размер</span>
                      )}
                    </>
                  )}
                </td>
                <td className="t-body px-3 py-2">{part.title}</td>
                <td className="t-small text-ink-muted px-3 py-2">{part.fitment ?? '—'}</td>
                <td
                  className="t-body px-3 py-2 text-right"
                  style={{ fontVariantNumeric: 'tabular-nums' }}
                >
                  {formatPrice(part.price)}
                </td>
                <td
                  className="t-body px-3 py-2 text-right"
                  style={{ fontVariantNumeric: 'tabular-nums' }}
                >
                  {part.qty > 0 ? (
                    formatNumber(part.qty)
                  ) : (
                    <span className="t-small text-danger">нет в наличии</span>
                  )}
                </td>
                <td
                  className="t-small px-3 py-2 text-right"
                  style={{ fontVariantNumeric: 'tabular-nums' }}
                >
                  {/* Пусто у 267 позиций из 269 — так в таблице, дорисовывать нечего */}
                  {part.marketPrice === null ? (
                    <span className="text-ink-muted">—</span>
                  ) : (
                    formatPrice(part.marketPrice)
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
