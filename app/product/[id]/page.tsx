/**
 * Карточка позиции — /product/:id.
 *
 * Ключ в адресе — колонка ID таблицы (решение 9), не артикул: артикула нет
 * у 91 позиции, и три значения повторяются у разных товаров.
 */
import { notFound } from 'next/navigation';
import { ProductDetail } from '../../../components/ProductDetail';
import { getParts } from '../../../lib/catalog';
import { toPublic } from '../../../lib/parts';

// Переменные Google доступны только в рантайме — см. комментарий в app/page.tsx.
export const dynamic = 'force-dynamic';

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const numericId = Number(id);

  if (!Number.isInteger(numericId) || numericId < 1) notFound();

  let read;
  try {
    read = await getParts();
  } catch (error) {
    console.error('Каталог недоступен:', error);

    return (
      <p className="t-body border-line bg-surface-raised rounded-md border px-6 py-6">
        Каталог временно недоступен. Обновите страницу через минуту.
      </p>
    );
  }

  const part = read.parts.find((item) => item.id === numericId);

  // Позиции нет или она отсеяна фильтром марок — для покупателя это одно и то же.
  if (part === undefined) notFound();

  return <ProductDetail part={toPublic(part)} />;
}
