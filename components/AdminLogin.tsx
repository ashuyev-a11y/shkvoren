/**
 * Форма входа оператора.
 *
 * Причина отказа не уточняется (решение 6): подсказка вроде «пароль короче»
 * помогает подбору.
 */
'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function AdminLogin() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSending(true);

    try {
      const response = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      if (!response.ok) {
        const data = await response.json();
        setError(data.error ?? 'Войти не удалось.');
        return;
      }

      // Cookie поставлена сервером. refresh нужен, чтобы серверная страница
      // /admin перечитала её и не отдала редирект обратно на вход.
      router.replace('/admin');
      router.refresh();
    } catch {
      setError('Связь прервалась. Проверьте интернет и попробуйте ещё раз.');
    } finally {
      setSending(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="border-line bg-surface-raised mx-auto max-w-[380px] rounded-md border px-6 py-6"
    >
      <h1 className="t-title m-0">Вход</h1>

      <label htmlFor="password" className="t-caption text-ink-muted mt-6 block">
        Пароль
      </label>
      <input
        id="password"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        autoComplete="current-password"
        aria-invalid={error !== null}
        className="t-body border-control-border bg-surface-raised mt-1 w-full rounded-md border px-3"
      />

      <button
        type="submit"
        disabled={sending || password === ''}
        className="t-body-strong bg-signal text-on-signal mt-4 w-full rounded-md px-6 disabled:opacity-60"
      >
        {sending ? 'Проверяем…' : 'Войти'}
      </button>

      {error !== null && (
        <p role="alert" className="t-small text-danger mt-2 mb-0">
          {error}
        </p>
      )}
    </form>
  );
}
