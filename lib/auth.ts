/**
 * Сессия админки — решение 6: один пароль в переменной окружения
 * и cookie-сессия. Supabase Auth и роли не нужны, оператор один.
 */
import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';

/** Имя cookie сессии. */
export const SESSION_COOKIE = 'shkv_admin';

/** Срок жизни сессии, секунды: 7 дней (docs/technical-spec.md §6). */
const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;

function requireSecret(): string {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret || secret.trim() === '') {
    throw new Error(
      'Не задана переменная ADMIN_SESSION_SECRET. Заполните .env.local по образцу .env.example.'
    );
  }
  return secret;
}

/** Подпись срока действия. Значение cookie — «срок.подпись». */
function sign(expiresAt: number): string {
  return createHmac('sha256', requireSecret()).update(String(expiresAt)).digest('hex');
}

/**
 * Сравнение строк за постоянное время.
 * Обычное === на секретах позволяет подобрать значение по времени ответа.
 */
function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/** Проверить пароль оператора. */
export function checkPassword(input: string): boolean {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected || expected.trim() === '') {
    throw new Error(
      'Не задана переменная ADMIN_PASSWORD. Вход в админку отключён до её заполнения.'
    );
  }
  return safeEqual(input, expected);
}

/** Выдать cookie сессии. */
export async function openSession(): Promise<void> {
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  const store = await cookies();

  store.set(SESSION_COOKIE, `${expiresAt}.${sign(expiresAt)}`, {
    httpOnly: true,
    // На Vercel всегда HTTPS; в локальной разработке по HTTP cookie не ставится
    // намеренно только в production-сборке.
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
  });
}

/** Закрыть сессию. */
export async function closeSession(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

/** Действует ли сессия сейчас. */
export async function hasSession(): Promise<boolean> {
  const value = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!value) return false;

  const [rawExpires, signature] = value.split('.');
  if (!rawExpires || !signature) return false;

  const expiresAt = Number(rawExpires);
  if (!Number.isFinite(expiresAt) || expiresAt < Math.floor(Date.now() / 1000)) {
    return false;
  }

  return safeEqual(signature, sign(expiresAt));
}
