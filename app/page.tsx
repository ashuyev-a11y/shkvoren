/**
 * Первый экран опт-витрины.
 *
 * Сейчас — только шапка экрана: заголовок, слоган и плашка точки выдачи.
 * Поиск (задача №6), список позиций и фильтры (задача №7) добавляются сюда же
 * после подключения Google-таблицы; они не сверстаны заранее, потому что
 * визуальный контракт экрана (docs/design/) ещё не передан.
 *
 * Все тексты — дословно из README (3).md, раздел «Голос».
 */
export default function HomePage() {
  return (
    <section>
      <h1 className="t-display m-0">Запчасти ГАЗ и УАЗ</h1>

      <p className="t-body mt-2 mb-0 text-ink-muted">
        Новые. В наличии в Уральске.
      </p>

      {/* Плашка «Забрать сегодня» — graphite (README (3).md, раздел «Цвет») */}
      <p className="t-body bg-graphite text-on-graphite mt-6 mb-0 inline-block rounded-md px-4 py-3">
        Забрать сегодня на Салеме
      </p>
    </section>
  );
}
