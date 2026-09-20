import type { Metadata } from 'next';
import { Unbounded, Onest, JetBrains_Mono } from 'next/font/google';
import '../styles/globals.css';

/**
 * Шрифты — три гарнитуры из README (3).md, подмножество с кириллицей.
 * Подключаются через next/font, чтобы не тянуть внешний запрос к Google Fonts.
 */
const unbounded = Unbounded({
  subsets: ['cyrillic', 'latin'],
  weight: ['700', '800'],
  display: 'swap',
  variable: '--font-display-loaded',
});

const onest = Onest({
  subsets: ['cyrillic', 'latin'],
  weight: ['400', '600', '700'],
  display: 'swap',
  variable: '--font-sans-loaded',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['cyrillic', 'latin'],
  weight: ['600', '700'],
  display: 'swap',
  variable: '--font-mono-loaded',
});

export const metadata: Metadata = {
  title: 'ШКВОРЕНЬ — запчасти ГАЗ и УАЗ в Уральске',
  // Слоган из README (3).md, дословно.
  description: 'Запчасти ГАЗ и УАЗ. Новые. В наличии в Уральске.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="ru"
      className={`${unbounded.variable} ${onest.variable} ${jetbrainsMono.variable}`}
    >
      <body>
        {/* Шапка — graphite, текст on-graphite (README (3).md, раздел «Цвет») */}
        <header className="bg-graphite text-on-graphite">
          <div className="mx-auto flex max-w-[1280px] items-center px-4 py-3 md:px-8">
            {/*
              Вордмарк гарнитурой Unbounded 800, прописными, трекинг −1%.
              Знак (shkvoren-mark.svg) в репозитории отсутствует — см.
              docs/technical-spec.md §9, блокирующий вопрос №6.
            */}
            <span
              className="t-title"
              style={{ fontFamily: 'var(--font-display)', letterSpacing: '-0.01em' }}
            >
              ШКВОРЕНЬ
            </span>
          </div>
        </header>

        <main className="mx-auto max-w-[1280px] px-4 py-6 md:px-8">{children}</main>

        {/* Подвал — тот же graphite */}
        <footer className="bg-graphite text-on-graphite">
          <div className="mx-auto max-w-[1280px] px-4 py-6 md:px-8">
            <p className="t-small m-0">Запчасти ГАЗ и УАЗ. Новые. В наличии в Уральске.</p>
          </div>
        </footer>
      </body>
    </html>
  );
}
