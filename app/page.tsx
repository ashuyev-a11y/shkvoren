/**
 * Опт-витрина — каталог списком.
 *
 * Страница серверная: таблица читается сервисным аккаунтом на сервере
 * с кэшем 4 минуты (решение 1), в браузер уходит только публичный срез
 * позиции (решение 5). Фильтрация и поиск — в CatalogClient.
 */
import { CatalogClient } from '../components/CatalogClient';
import { getParts } from '../lib/catalog';
import { collectCategories, toPublic } from '../lib/parts';

/*
 * Страница рендерится на запрос, а не при сборке.
 *
 * На сборке переменных Google нет (на Vercel они доступны только в рантайме
 * функции), и статическая версия запеклась бы с сообщением об ошибке —
 * покупатель видел бы «каталог недоступен» до первой ревалидации.
 * Дороговизны в этом нет: getParts держит свой кэш на 4 минуты,
 * обращения к таблице на каждый запрос не происходит.
 */
export const dynamic = 'force-dynamic';

export default async function HomePage() {
  let parts;
  try {
    const read = await getParts();
    parts = read.parts.map(toPublic);
  } catch (error) {
    // Каталог недоступен — показываем это прямо, а не пустой список:
    // пустая витрина выглядит как «товар кончился», что неправда.
    console.error('Каталог недоступен:', error);

    return (
      <section>
        <h1 className="t-display m-0">Запчасти ГАЗ и УАЗ</h1>
        <p className="t-body border-line bg-surface-raised mt-6 mb-0 rounded-md border px-6 py-6">
          Каталог временно недоступен. Обновите страницу через минуту или напишите нам.
        </p>
      </section>
    );
  }

  return (
    <section>
      <h1 className="t-display m-0">Запчасти ГАЗ и УАЗ</h1>

      <p className="t-body text-ink-muted mt-2 mb-6">
        Новые. В наличии в Уральске. Забрать сегодня на Салеме.
      </p>

      <CatalogClient parts={parts} categories={collectCategories(parts)} />
    </section>
  );
}
