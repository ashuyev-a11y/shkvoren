/**
 * Поле «Предложить свою цену» — решение 18.
 *
 * По умолчанию свёрнуто в ссылку: тот, кто не торгуется, не видит лишнего
 * поля и оформляет заказ теми же движениями, что и раньше. Развёрнутое
 * поле остаётся открытым, пока в нём есть значение.
 *
 * Валидация только базовая — целое число больше нуля. Отсечки «не ниже
 * прайса» здесь нет намеренно: цена в таблице и так себестоимость
 * (решение 0), поэтому предложение ниже неё — осознанный торг, а не ошибка.
 * Соглашаться или нет, решает продавец в переписке.
 */
'use client';

import { useId, useState } from 'react';

type Props = {
  /** Текущее предложение, null — торга нет. */
  value: number | null;
  /** Передаёт целое число либо null, если поле опустошили. */
  onChange: (next: number | null) => void;
  /** Подпись поля: у позиции и у всего заказа она разная. */
  label: string;
  /** Текст свёрнутой ссылки. */
  linkLabel: string;
  /** Уточнение, которое видно рядом с раскрытым полем. */
  hint?: string;
};

export function OfferPrice({ value, onChange, label, linkLabel, hint }: Props) {
  const fieldId = useId();

  // Раскрыто, если торг уже начат: иначе введённое значение пропадало бы
  // из виду при возврате на страницу.
  const [open, setOpen] = useState(value !== null);

  // Черновик ввода отдельно от значения: пока покупатель стирает цифры,
  // поле обязано показывать пустую строку, а не подставленный ноль.
  const [draft, setDraft] = useState(value === null ? '' : String(value));

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="t-small text-ink-muted hover:text-ink min-h-0 p-0 underline underline-offset-2"
      >
        {linkLabel}
      </button>
    );
  }

  /** Целое больше нуля или null: всё остальное считается снятым торгом. */
  function apply(raw: string) {
    setDraft(raw);

    const digits = raw.replace(/\s/g, '');
    if (digits === '') {
      onChange(null);
      return;
    }

    const parsed = Number(digits);
    if (!Number.isFinite(parsed) || parsed < 1) {
      onChange(null);
      return;
    }
    onChange(Math.trunc(parsed));
  }

  // Ввели что-то, но это не цена: молча игнорировать нельзя — покупатель
  // будет уверен, что предложил цену, а продавец её не увидит.
  const invalid = draft.trim() !== '' && value === null;

  return (
    <div>
      <label htmlFor={fieldId} className="t-caption text-ink-muted block">
        {label}
      </label>

      <div className="mt-1 flex items-center gap-2">
        <input
          id={fieldId}
          type="number"
          inputMode="numeric"
          min={1}
          step={1}
          value={draft}
          onChange={(e) => apply(e.target.value)}
          placeholder="0"
          aria-invalid={invalid}
          aria-describedby={invalid ? `${fieldId}-error` : undefined}
          className={`t-body bg-surface-raised w-32 rounded-md border px-3 ${
            invalid ? 'border-danger' : 'border-control-border'
          }`}
          style={{ fontVariantNumeric: 'tabular-nums' }}
        />
        <span className="t-small text-ink-muted">₸</span>

        <button
          type="button"
          onClick={() => {
            setDraft('');
            onChange(null);
            setOpen(false);
          }}
          className="t-small text-ink-muted hover:text-ink min-h-0 p-2 underline underline-offset-2"
        >
          Отменить
        </button>
      </div>

      {invalid && (
        <p id={`${fieldId}-error`} className="t-small text-danger mt-1 mb-0">
          Укажите целое число больше нуля.
        </p>
      )}

      {hint !== undefined && !invalid && (
        <p className="t-small text-ink-muted mt-1 mb-0">{hint}</p>
      )}
    </div>
  );
}
