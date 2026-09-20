/**
 * Тост: тёмная пилюля по центру снизу, гаснет сама (хэндоф §4).
 *
 * Для программы чтения экрана это область с role="status": сообщение
 * произносится, но фокус не забирает.
 */
'use client';

import { useEffect } from 'react';
import { TOAST_MS, useToast } from '../lib/toast';

export function Toast() {
  const message = useToast((s) => s.message);
  const seq = useToast((s) => s.seq);
  const hide = useToast((s) => s.hide);

  useEffect(() => {
    if (message === null) return;
    const timer = setTimeout(hide, TOAST_MS);
    // Таймер перезапускается при каждом новом показе, в том числе
    // при повторе того же текста — отсюда seq в зависимостях.
    return () => clearTimeout(timer);
  }, [message, seq, hide]);

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-12 z-50 flex justify-center px-4"
    >
      {message !== null && (
        <p className="t-body-strong bg-graphite text-on-graphite m-0 rounded-full px-6 py-3 shadow-[var(--shadow-sm)]">
          {message}
        </p>
      )}
    </div>
  );
}
