import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FlatCompat } from '@eslint/eslintrc';

const compat = new FlatCompat({
  baseDirectory: dirname(fileURLToPath(import.meta.url)),
});

/**
 * Правила ШКВОРЕНЬ — docs/technical-spec.md §10.
 *
 * Здесь только то, что ESLint умеет проверить по AST.
 * Текстовые проверки (хардкод номера WhatsApp, утечка ключа Google,
 * hex-цвета) вынесены в scripts/check-guards.mjs: они ищутся по всему
 * файлу, включая строки и комментарии, и это надёжнее плагина.
 */
const config = [
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  {
    ignores: [
      'node_modules/**',
      '.next/**',
      '_archive/**',
      'styles/tokens.css', // генерируется scripts/generate-tokens.mjs
      'next-env.d.ts', // генерируется Next.js при сборке, в git не попадает
    ],
  },
  {
    rules: {
      // Запрещённые зависимости (docs/technical-spec.md §2).
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'googleapis',
              message:
                'Использовать google-auth-library + fetch к REST API v4 (technical-spec §2).',
            },
            {
              name: 'pdf-lib',
              message: 'Печать через window.print(), а не генерацию PDF (решение «Экраны»).',
            },
            {
              name: '@prisma/client',
              message: 'Базы данных нет: мастер-источник — Google-таблица (решение 1).',
            },
          ],
          patterns: [
            {
              group: ['@supabase/*'],
              message: 'Supabase в MVP не используется (решения 1 и 6).',
            },
          ],
        },
      ],

      // Строгость типов: any пропускает ошибки данных из таблицы.
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],

      // Заглушки запрещены (AGENTS.md, «Правила завершения задач»).
      'no-warning-comments': [
        'error',
        { terms: ['todo', 'fixme', 'заглушка', 'временно'], location: 'anywhere' },
      ],
    },
  },
];

export default config;
