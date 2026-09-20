/**
 * Пустое состояние — хэндоф §2.
 *
 * Используется, когда поиск ничего не нашёл и когда корзина пуста.
 * Текст всегда объясняет, что делать дальше: «ничего не найдено» без
 * продолжения оставляет покупателя в тупике.
 */
export function EmptyState({
  title,
  hint,
  action,
}: {
  title: string;
  hint: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="border-line bg-surface-raised rounded-md border px-6 py-12 text-center">
      <p className="t-heading m-0">{title}</p>
      <p className="t-body text-ink-muted mt-2 mb-0">{hint}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
