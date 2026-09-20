/**
 * Генератор CSS-переменных из tokens.json.
 *
 * tokens.json — единственный источник визуальных значений (AGENTS.md).
 * Этот скрипт переносит его в styles/tokens.css, который НИКТО не правит руками:
 * файл перезаписывается при каждом `npm run dev` и `npm run build`.
 *
 * Запуск: node scripts/generate-tokens.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const tokens = JSON.parse(readFileSync(join(root, 'tokens.json'), 'utf8'));

/** Имя темы, которая считается базовой (пишется в :root). */
const BASE_THEME = 'light';

const lines = [];
const push = (s = '') => lines.push(s);

push('/*');
push(' * СГЕНЕРИРОВАННЫЙ ФАЙЛ — НЕ РЕДАКТИРОВАТЬ.');
push(' * Источник: tokens.json. Пересоздаётся: npm run tokens');
push(` * Дизайн-система: ${tokens.name}, версия ${tokens.version}`);
push(' */');
push();

// --- Цвет: базовая тема в :root ------------------------------------------
push(':root {');
push('  /* Цвет */');
for (const token of tokens.color.tokens) {
  push(`  --${token.name}: ${token.value[BASE_THEME]};`);
}

// --- Гарнитуры ------------------------------------------------------------
push();
push('  /* Гарнитуры */');
for (const [alias, stack] of Object.entries(tokens.type.families)) {
  push(`  --font-${alias}: ${stack};`);
}

// --- Типографика: каждый стиль четырьмя переменными ------------------------
push();
push('  /* Типографика */');
for (const group of tokens.type.groups) {
  for (const style of group.styles) {
    push(`  --text-${style.name}-family: var(--font-${group.family});`);
    push(`  --text-${style.name}-size: ${style.fontSize};`);
    push(`  --text-${style.name}-line: ${style.lineHeight};`);
    push(`  --text-${style.name}-weight: ${style.fontWeight};`);
    if (style.letterSpacing) {
      push(`  --text-${style.name}-tracking: ${style.letterSpacing};`);
    }
  }
}

// --- Отступы, радиусы, тени ------------------------------------------------
for (const [title, group] of [
  ['Отступы', tokens.spacing],
  ['Радиусы', tokens.radius],
]) {
  push();
  push(`  /* ${title} */`);
  for (const token of group.tokens) {
    push(`  --${token.name}: ${token.value};`);
  }
}

push();
push('  /* Тени */');
for (const token of tokens.shadow.tokens) {
  push(`  --${token.name}: ${token.value[BASE_THEME]};`);
}
push('}');

// --- Тёмная тема ------------------------------------------------------------
// Пишется под явным атрибутом, а не под prefers-color-scheme: тёмная тема
// вне MVP (docs/technical-spec.md §12), но значения из tokens.json не теряем.
push();
push('[data-theme="dark"] {');
for (const token of tokens.color.tokens) {
  push(`  --${token.name}: ${token.value.dark};`);
}
push();
for (const token of tokens.shadow.tokens) {
  push(`  --${token.name}: ${token.value.dark};`);
}
push('}');

// --- Классы типографики -----------------------------------------------------
// Чтобы в компонентах не набирать четыре переменные руками и не мимо токенов.
push();
push('/* Классы типографики: по одному на стиль из tokens.json */');
for (const group of tokens.type.groups) {
  for (const style of group.styles) {
    push(`.t-${style.name} {`);
    push(`  font-family: var(--text-${style.name}-family);`);
    push(`  font-size: var(--text-${style.name}-size);`);
    push(`  line-height: var(--text-${style.name}-line);`);
    push(`  font-weight: var(--text-${style.name}-weight);`);
    if (style.letterSpacing) {
      push(`  letter-spacing: var(--text-${style.name}-tracking);`);
    }
    // Цена: табличные цифры — требование брендбука (README (3).md).
    if (style.name === 'price') {
      push('  font-variant-numeric: tabular-nums;');
    }
    // Бейджи и статусы — прописными (стиль caption в tokens.json).
    if (style.name === 'caption') {
      push('  text-transform: uppercase;');
    }
    push('}');
  }
}

const css = lines.join('\n') + '\n';
mkdirSync(join(root, 'styles'), { recursive: true });
writeFileSync(join(root, 'styles', 'tokens.css'), css, 'utf8');

const colors = tokens.color.tokens.length;
const styles = tokens.type.groups.reduce((n, g) => n + g.styles.length, 0);
console.log(
  `tokens.css: ${colors} цветов, ${styles} стилей текста, ` +
    `${tokens.spacing.tokens.length} отступов, ${tokens.radius.tokens.length} радиусов`
);
