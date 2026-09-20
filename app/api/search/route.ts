/**
 * GET /api/search?q= — поиск по номеру и названию.
 *
 * Контракт: docs/technical-spec.md §6. Поиск идёт в памяти по кэшированному
 * каталогу, порядок выдачи задан в docs/data-model.md §5.
 */
import { NextResponse } from 'next/server';
import { getParts } from '@/lib/catalog';
import { toPublic } from '@/lib/parts';
import { MIN_QUERY_LENGTH, searchParts } from '@/lib/search';
import { SheetsError } from '@/lib/sheets';

/** Верхняя граница выдачи: длинный список у прилавка бесполезен. */
const LIMIT = 50;

export async function GET(request: Request) {
  const query = (new URL(request.url).searchParams.get('q') ?? '').trim();

  // Пустой результат — это HTTP 200 с пустым списком: «ничего не найдено»
  // рисует интерфейс, ошибкой такой ответ не является.
  if (query.length < MIN_QUERY_LENGTH) {
    return NextResponse.json({ items: [], total: 0, q: query });
  }

  try {
    const read = await getParts();
    const found = searchParts(read.parts, query, LIMIT);

    return NextResponse.json({
      items: found.map(toPublic),
      total: found.length,
      q: query,
    });
  } catch (error) {
    console.error('Поиск недоступен:', error);
    const message =
      error instanceof SheetsError
        ? 'Каталог временно недоступен. Попробуйте обновить страницу через минуту.'
        : 'Не удалось выполнить поиск.';
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
