/**
 * Чтение каталога из Google-таблицы с кэшированием.
 *
 * Разделение ответственности:
 *   lib/sheets.ts   — транспорт (знает про ключ и HTTP);
 *   lib/parts.ts    — разбор и правила данных (чистые функции, без ввода-вывода);
 *   этот модуль     — соединяет их и держит кэш (docs/technical-spec.md §5).
 */
import 'server-only';
import { unstable_cache, revalidateTag } from 'next/cache';
import { getValues, partsSheetName, SheetsError } from './sheets.ts';
import { parseSheet } from './parts.ts';
import type { PartsRead } from '../types/part.ts';

/** Тег кэша. Кнопка «Обновить сейчас» в админке сбрасывает именно его. */
export const PARTS_CACHE_TAG = 'parts';

/**
 * Время жизни кэша, секунды. Решение 1 задаёт интервал 3–5 минут,
 * берём середину: 4 минуты.
 */
const REVALIDATE_SECONDS = 240;

/**
 * Читаемый диапазон: до колонки AI включительно (в ней ключ ID),
 * строки с запасом — лист содержит хвост шаблона, он отсеивается при разборе.
 */
function partsRange(): string {
  return `${partsSheetName()}!A1:AI2000`;
}

/** Прочитать и разобрать лист без кэша. */
async function readPartsUncached(): Promise<PartsRead> {
  const rows = await getValues(partsRange());

  if (rows.length === 0) {
    throw new SheetsError(
      'Лист каталога пуст. Проверьте имя листа в SHEET_PARTS_NAME и доступ сервисного аккаунта.'
    );
  }

  return parseSheet(rows, new Date().toISOString());
}

/**
 * Каталог с кэшем.
 *
 * Возвращает и позиции, и список проблем: витрина показывает первое,
 * админка — второе. Скрывать проблемы от оператора нельзя, иначе позиция
 * молча исчезнет со витрины без объяснения причины.
 */
export const getParts = unstable_cache(readPartsUncached, ['parts'], {
  revalidate: REVALIDATE_SECONDS,
  tags: [PARTS_CACHE_TAG],
});

/** Сбросить кэш каталога — вызывается из /api/admin/refresh. */
export function refreshParts(): void {
  revalidateTag(PARTS_CACHE_TAG);
}
