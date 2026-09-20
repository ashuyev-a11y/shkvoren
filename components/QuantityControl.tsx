/**
 * Степпер количества — хэндоф §2 и §4.
 *
 * Значение ограничено отрезком [0, stock]: минус на нуле и плюс на потолке
 * склада выключены нативным disabled, а не только стилем, чтобы состояние
 * читала программа чтения экрана (хэндоф §7).
 */
'use client';

type Props = {
  value: number;
  /** Остаток на складе — верхняя граница. */
  max: number;
  onChange: (next: number) => void;
  /** Название позиции: уходит в aria-label кнопок. */
  title: string;
};

export function QuantityControl({ value, max, onChange, title }: Props) {
  const disabled = max <= 0;

  return (
    <div className="border-control-border inline-flex items-stretch rounded-md border">
      <button
        type="button"
        onClick={() => onChange(value - 1)}
        disabled={disabled || value <= 0}
        aria-label={`Убрать одну штуку: ${title}`}
        className="t-body-strong w-12 rounded-l-md disabled:opacity-40"
      >
        −
      </button>

      <input
        type="number"
        inputMode="numeric"
        value={value}
        min={0}
        max={max}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={`Количество: ${title}`}
        className="border-control-border w-12 border-x text-center disabled:opacity-40"
        style={{ fontVariantNumeric: 'tabular-nums' }}
      />

      <button
        type="button"
        onClick={() => onChange(value + 1)}
        disabled={disabled || value >= max}
        aria-label={`Добавить одну штуку: ${title}`}
        className="t-body-strong w-12 rounded-r-md disabled:opacity-40"
      >
        +
      </button>
    </div>
  );
}
