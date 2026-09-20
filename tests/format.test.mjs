/**
 * Тесты форматирования — docs/technical-spec.md §11.
 *
 * Проверяют требование брендбука: цена «17 500 ₸» с пробелом-разделителем.
 * Запуск: npm test
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

// lib/format.ts на TypeScript — Node 22 исполняет его напрямую (type stripping).
import { formatNumber, formatPrice, formatQty, normalizePhone, isValidPhone } from '../lib/format.ts';

const THIN_NBSP = '\u202F';

test('цена 17500 форматируется как «17 500 ₸»', () => {
  assert.equal(formatPrice(17500), `17${THIN_NBSP}500${THIN_NBSP}₸`);
});

test('разряды расставляются на всех длинах из данных', () => {
  // Границы взяты из снимка: минимальная цена 50, максимальная 300 000,
  // стоимость склада 13 926 450 (docs/data-model.md §1).
  assert.equal(formatNumber(50), '50');
  assert.equal(formatNumber(2000), `2${THIN_NBSP}000`);
  assert.equal(formatNumber(300000), `300${THIN_NBSP}000`);
  assert.equal(formatNumber(13926450), `13${THIN_NBSP}926${THIN_NBSP}450`);
});

test('количество выводится штуками', () => {
  // Максимальный остаток в данных — 214.
  assert.equal(formatQty(214), '214 шт');
  assert.equal(formatQty(1), '1 шт');
});

// Номер продавца в тестах не используется намеренно: он живёт только
// в переменной окружения (решение 13), это проверяет scripts/check-guards.mjs.
test('телефон очищается до цифр, ведущая 8 приводится к 7', () => {
  assert.equal(normalizePhone('+7 701 111 22 33'), '77011112233');
  assert.equal(normalizePhone('8 701 111 22 33'), '77011112233');
});

test('телефон короче 10 цифр отклоняется', () => {
  assert.equal(isValidPhone('+7 701 111 22 33'), true);
  assert.equal(isValidPhone('701111'), false);
  assert.equal(isValidPhone(''), false);
});
