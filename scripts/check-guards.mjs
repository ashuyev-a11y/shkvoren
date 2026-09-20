/**
 * Текстовые гейты проекта — docs/technical-spec.md §10.
 *
 * Проверяет то, что нельзя поймать линтером по AST: значения, зашитые
 * в строки, и токены дизайн-системы, набранные hex-ом мимо tokens.json.
 *
 * Запуск: node scripts/check-guards.mjs
 * Код возврата 1 — хотя бы одно нарушение.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep, extname } from 'node:path';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Каталоги, которые не проверяем. */
const SKIP_DIRS = new Set(['node_modules', '.next', '.git', '_archive', 'docs']);

/** Расширения исходников. */
const EXTENSIONS = new Set(['.ts', '.tsx', '.mjs', '.js', '.jsx', '.css']);

/**
 * Правила. `allow` — файлы, где нарушение является нормой
 * (единственное место, которому положено знать значение).
 */
const RULES = [
  {
    id: 'whatsapp-number',
    // Номер продавца: любая последовательность 777 250 84 20 с разделителями и без.
    test: /7\D?7\D?7\D?7\D?2\D?5\D?0\D?8\D?4\D?2\D?0/,
    allow: ['.env.example', 'scripts/check-guards.mjs'],
    message:
      'Номер WhatsApp только в NEXT_PUBLIC_WHATSAPP_NUMBER, не в коде (решение 13).',
  },
  {
    id: 'wa-link',
    test: /wa\.me/,
    // tests/whatsapp.test.mjs проверяет формат ссылки дословно — в этом
    // и состоит тест контракта. Номер в нём подставной, не номер продавца.
    allow: ['lib/whatsapp.ts', 'tests/whatsapp.test.mjs', 'scripts/check-guards.mjs'],
    message: 'Ссылка wa.me собирается только в lib/whatsapp.ts (technical-spec §8).',
  },
  {
    id: 'google-key',
    test: /GOOGLE_PRIVATE_KEY/,
    // scripts/check-sheet.mjs — диагностика, исполняется в обычном Node:
    // импортировать lib/sheets.ts он не может из-за 'server-only' и next/cache,
    // поэтому повторяет получение токена у себя. В бандл приложения не входит.
    allow: [
      'lib/sheets.ts',
      'scripts/check-sheet.mjs',
      '.env.example',
      'scripts/check-guards.mjs',
    ],
    message: 'Ключ сервисного аккаунта читается только в lib/sheets.ts (technical-spec §4).',
  },
  {
    id: 'hex-color',
    // Цвет мимо токенов. tokens.css исключён: он и есть результат генерации.
    test: /#[0-9a-fA-F]{3,8}\b/,
    allow: ['styles/tokens.css', 'scripts/generate-tokens.mjs', 'scripts/check-guards.mjs'],
    message: 'Цвета только из tokens.json через переменные var(--…) (AGENTS.md).',
  },
];

/** Рекурсивный обход файлов проекта. */
function* walk(dir) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      yield* walk(full);
    } else if (EXTENSIONS.has(extname(name))) {
      yield full;
    }
  }
}

const violations = [];

for (const file of walk(root)) {
  const rel = relative(root, file).split(sep).join('/');
  const lines = readFileSync(file, 'utf8').split('\n');

  for (const rule of RULES) {
    if (rule.allow.includes(rel)) continue;
    lines.forEach((line, i) => {
      if (rule.test.test(line)) {
        violations.push({ rel, line: i + 1, rule, text: line.trim().slice(0, 80) });
      }
    });
  }
}

// .env.example проверяем отдельно: в нём не должно быть заполненных секретов.
const envExample = join(root, '.env.example');
try {
  for (const [i, line] of readFileSync(envExample, 'utf8').split('\n').entries()) {
    const m = /^(GOOGLE_PRIVATE_KEY|ADMIN_PASSWORD|ADMIN_SESSION_SECRET|SHEET_ID)=(.+)$/.exec(
      line.trim()
    );
    if (m) {
      violations.push({
        rel: '.env.example',
        line: i + 1,
        rule: { id: 'env-secret', message: `Переменная ${m[1]} должна быть пустой в примере.` },
        text: line.trim().slice(0, 40),
      });
    }
  }
} catch {
  violations.push({
    rel: '.env.example',
    line: 0,
    rule: { id: 'env-missing', message: 'Файл .env.example обязателен (technical-spec §4).' },
    text: '',
  });
}

if (violations.length === 0) {
  console.log('Гейты пройдены: нарушений нет.');
  process.exit(0);
}

console.error(`Нарушений: ${violations.length}\n`);
for (const v of violations) {
  console.error(`  ${v.rel}:${v.line}  [${v.rule.id}]  ${v.rule.message}`);
  if (v.text) console.error(`    ${v.text}`);
}
process.exit(1);
