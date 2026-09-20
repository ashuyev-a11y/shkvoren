/**
 * POST /api/admin/refresh — кнопка «Обновить сейчас».
 *
 * Сбрасывает кэш каталога, не дожидаясь истечения 4 минут (решение 1).
 * Контракт: docs/technical-spec.md §6.
 */
import { NextResponse } from 'next/server';
import { hasSession } from '@/lib/auth';
import { refreshParts } from '@/lib/catalog';

export async function POST() {
  if (!(await hasSession())) {
    return NextResponse.json({ error: 'Войдите в админку.' }, { status: 401 });
  }

  refreshParts();

  return NextResponse.json({ ok: true, refreshedAt: new Date().toISOString() });
}
