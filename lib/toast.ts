/**
 * Всплывающие сообщения — хэндоф §4.
 *
 * Одно сообщение за раз: два наложенных тоста у прилавка не читаются.
 * Ошибки валидации через тост не показываются — они остаются подписью
 * под полем, потому что сообщение об ошибке не должно исчезать само.
 */
'use client';

import { create } from 'zustand';

/** Сколько сообщение держится на экране, мс. */
export const TOAST_MS = 2000;

type ToastState = {
  message: string | null;
  /** Счётчик показов: нужен, чтобы повторный тот же текст перезапустил таймер. */
  seq: number;
  show: (message: string) => void;
  hide: () => void;
};

export const useToast = create<ToastState>((set) => ({
  message: null,
  seq: 0,
  show: (message) => set((state) => ({ message, seq: state.seq + 1 })),
  hide: () => set({ message: null }),
}));
