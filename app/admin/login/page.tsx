/**
 * Вход в админку — /admin/login.
 *
 * Решение 6: один пароль в переменной окружения, один оператор.
 * Ролей, регистрации и восстановления пароля нет.
 */
import { redirect } from 'next/navigation';
import { AdminLogin } from '../../../components/AdminLogin';
import { hasSession } from '../../../lib/auth';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Вход — ШКВОРЕНЬ',
};

export default async function AdminLoginPage() {
  // Уже вошедшему форма не нужна.
  if (await hasSession()) redirect('/admin');

  return <AdminLogin />;
}
