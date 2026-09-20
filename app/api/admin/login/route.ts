/**
 * POST /api/admin/login — вход оператора.
 *
 * Решение 6: один пароль в переменной окружения, cookie-сессия.
 * Контракт: docs/technical-spec.md §6.
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { checkPassword, openSession } from '@/lib/auth';

const Body = z.object({ password: z.string().min(1) });

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'Введите пароль.' }, { status: 400 });
  }

  const parsed = Body.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Введите пароль.' }, { status: 400 });
  }

  let ok: boolean;
  try {
    ok = checkPassword(parsed.data.password);
  } catch (error) {
    // Не заданы переменные окружения — это отказ настройки, а не неверный пароль.
    console.error('Вход в админку не настроен:', error);
    return NextResponse.json({ error: 'Вход не настроен.' }, { status: 503 });
  }

  if (!ok) {
    // Причину не уточняем: подсказка «пароль короче» помогает подбору.
    return NextResponse.json({ error: 'Пароль не подошёл.' }, { status: 401 });
  }

  await openSession();
  return NextResponse.json({ ok: true });
}
