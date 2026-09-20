/**
 * GET /api/parts — список позиций каталога.
 *
 * Контракт параметров и ответа: docs/technical-spec.md §6.
 * Наружу уходит только публичный срез позиции (docs/data-model.md §9).
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getParts } from '@/lib/catalog';
import { collectCategories, toPublic } from '@/lib/parts';
import { SheetsError } from '@/lib/sheets';

/** Значения по умолчанию и границы — из контракта. */
const Query = z.object({
  brand: z.enum(['ГАЗ', 'УАЗ']).optional(),
  category: z.string().trim().min(1).optional(),
  inStock: z.literal('1').optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const parsed = Query.safeParse(Object.fromEntries(searchParams));
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Проверьте параметры запроса.' },
      { status: 400 }
    );
  }
  const { brand, category, inStock, limit, offset } = parsed.data;

  let read;
  try {
    read = await getParts();
  } catch (error) {
    // Покупателю показывается текст по голосу бренда, подробности — в журнал.
    console.error('Каталог недоступен:', error);
    const message =
      error instanceof SheetsError
        ? 'Каталог временно недоступен. Попробуйте обновить страницу через минуту.'
        : 'Не удалось получить каталог.';
    return NextResponse.json({ error: message }, { status: 503 });
  }

  let items = read.parts.map(toPublic);

  if (brand) items = items.filter((part) => part.brands.includes(brand));
  if (category) items = items.filter((part) => part.category === category);
  // «Только в наличии»: остаток в данных бывает нулевым после ручной правки.
  if (inStock) items = items.filter((part) => part.qty > 0);

  return NextResponse.json({
    items: items.slice(offset, offset + limit),
    total: items.length,
    limit,
    offset,
    // Список фильтра строится из данных, а не из константы в коде.
    categories: collectCategories(items),
    readAt: read.readAt,
  });
}
