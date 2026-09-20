/**
 * Админка — /admin.
 *
 * Решение 1: Google-таблица — единственный источник, оператор правит данные
 * в ней. Поэтому здесь только просмотр: таблица позиций, найденные проблемы
 * и кнопка «Обновить сейчас».
 *
 * Экранов правки товара и заказа нет (разбор хэндофа, пункт A5): ни колонки
 * статуса, ни журнала изменений в таблице не заведено, а правка без них
 * потерялась бы при следующем чтении листа.
 */
import { redirect } from 'next/navigation';
import { AdminCatalog } from '../../components/AdminCatalog';
import { hasSession } from '../../lib/auth';
import { getParts } from '../../lib/catalog';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Админка — ШКВОРЕНЬ',
};

export default async function AdminPage() {
  if (!(await hasSession())) redirect('/admin/login');

  let read;
  try {
    read = await getParts();
  } catch (error) {
    // Оператору причина нужна целиком: он же и чинит доступ к таблице.
    const reason = error instanceof Error ? error.message : 'Неизвестная ошибка.';

    return (
      <section>
        <h1 className="t-title m-0">Админка</h1>
        <p className="t-body border-line bg-surface-raised mt-6 mb-0 rounded-md border px-6 py-6">
          Каталог не прочитан. {reason}
        </p>
      </section>
    );
  }

  return <AdminCatalog parts={read.parts} issues={read.issues} readAt={read.readAt} />;
}
