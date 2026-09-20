/**
 * Тесты поиска — docs/technical-spec.md §11.
 *
 * Проверка идёт по реальному снимку таблицы: запросы взяты те, которые
 * наберёт механик у прилавка, а ожидания сверены с содержимым данных.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readSheet } from '../scripts/xlsx-read.mjs';
import { COLUMN, parseSheet } from '../lib/parts.ts';
import { MIN_QUERY_LENGTH, searchParts, trigramSimilarity } from '../lib/search.ts';

const SNAPSHOT = 'Запчасти_с_ценами_рынка (2).xlsx';

/** Снимок с проставленной колонкой ID — так таблица будет выглядеть после задачи оператора. */
function loadParts() {
  const rows = readSheet(SNAPSHOT, 'Запчасти');
  const out = [rows[0]];
  let id = 0;
  for (let i = 1; i < rows.length; i += 1) {
    const cells = [...(rows[i] ?? [])];
    const hasContent =
      (cells[COLUMN.article] ?? '').trim() !== '' ||
      (cells[COLUMN.title] ?? '').trim() !== '' ||
      (cells[COLUMN.category] ?? '').trim() !== '';
    if (!hasContent) continue;
    id += 1;
    cells[COLUMN.id] = String(id);
    out.push(cells);
  }
  return parseSheet(out, '').parts;
}

const parts = loadParts();

// --- Поиск по номеру -------------------------------------------------------

test('полный артикул находит позицию первой', () => {
  const found = searchParts(parts, '4693501070');
  assert.ok(found.length > 0, 'артикул 4693501070 есть в данных');
  assert.equal(found[0].article, '4693501070');
  assert.equal(found[0].title, 'Задний тормозной барабан');
});

test('часть номера находит позицию — механик помнит не весь артикул', () => {
  const found = searchParts(parts, '3501');
  const ids = found.map((part) => part.articleNorm);
  assert.ok(
    ids.some((article) => article.includes('3501')),
    'найдены позиции, содержащие 3501'
  );
});

test('фрагмент короче четырёх знаков не ищется по номеру', () => {
  // «350» содержится в десятках артикулов, такая выдача бесполезна.
  const byFragment = searchParts(parts, '350');
  for (const part of byFragment) {
    assert.notEqual(
      part.articleNorm.includes('350') && part.articleNorm !== '350',
      true,
      `позиция ${part.id} найдена по слишком короткому фрагменту номера`
    );
  }
});

test('артикул находится независимо от раскладки', () => {
  // В данных номер записан кириллической А: 53А170201002.
  const cyrillic = searchParts(parts, '53А170201002');
  const latin = searchParts(parts, '53A170201002');
  assert.ok(cyrillic.length > 0, 'позиция с кириллическим артикулом есть в данных');
  assert.deepEqual(
    latin.map((part) => part.id),
    cyrillic.map((part) => part.id)
  );
});

test('артикул находится с дефисами и без них', () => {
  const withDashes = searchParts(parts, '0469-00-1602558-00');
  const withoutDashes = searchParts(parts, '046900160255800');
  assert.ok(withDashes.length > 0);
  assert.deepEqual(
    withoutDashes.map((part) => part.id),
    withDashes.map((part) => part.id)
  );
});

// --- Поиск по названию -----------------------------------------------------

test('запрос из нескольких слов находит позицию', () => {
  const found = searchParts(parts, 'тормозной барабан');
  assert.ok(found.length > 0);
  assert.ok(
    found.every((part) => /барабан/i.test(part.title)),
    'в выдаче только барабаны'
  );
});

test('порядок слов в запросе не важен', () => {
  const direct = searchParts(parts, 'тормозной барабан').map((part) => part.id).sort();
  const reversed = searchParts(parts, 'барабан тормозной').map((part) => part.id).sort();
  assert.deepEqual(reversed, direct);
});

test('опечатка не мешает найти позицию', () => {
  // «тормазной» вместо «тормозной» — частая ошибка при быстром наборе.
  const found = searchParts(parts, 'тормазной барабан');
  assert.ok(found.length > 0, 'триграммное сходство отработало');
});

test('регистр запроса не важен', () => {
  const lower = searchParts(parts, 'шкворень').map((part) => part.id);
  const upper = searchParts(parts, 'ШКВОРЕНЬ').map((part) => part.id);
  assert.deepEqual(upper, lower);
});

// --- Поведение на границах -------------------------------------------------

test('запрос короче двух знаков даёт пустую выдачу', () => {
  assert.equal(MIN_QUERY_LENGTH, 2);
  assert.deepEqual(searchParts(parts, 'ш'), []);
  assert.deepEqual(searchParts(parts, ' '), []);
  assert.deepEqual(searchParts(parts, ''), []);
});

test('бессмысленный запрос даёт пустую выдачу, а не весь каталог', () => {
  const found = searchParts(parts, 'ячсмитьбю');
  assert.equal(found.length, 0);
});

test('запрос «УАЗ» не возвращает весь каталог', () => {
  // Применимость отдельным критерием поиска не является: иначе выдача
  // превратится в список из 262 позиций и потеряет смысл.
  const found = searchParts(parts, 'УАЗ');
  assert.ok(found.length < parts.length, `найдено ${found.length} из ${parts.length}`);
});

test('выдача ограничена запрошенным числом позиций', () => {
  const found = searchParts(parts, 'сальник', 5);
  assert.ok(found.length <= 5);
});

test('порядок выдачи повторяется от запроса к запросу', () => {
  const first = searchParts(parts, 'подшипник').map((part) => part.id);
  const second = searchParts(parts, 'подшипник').map((part) => part.id);
  assert.deepEqual(second, first);
});

// --- Триграммы -------------------------------------------------------------

test('сходство одинаковых строк равно единице, разных — нулю', () => {
  assert.equal(trigramSimilarity('шкворень', 'шкворень'), 1);
  assert.equal(trigramSimilarity('шкворень', ''), 0);
  assert.ok(trigramSimilarity('шкворень', 'фильтр масляный') < 0.1);
});

test('сходство устойчиво к «ё» и регистру', () => {
  assert.equal(trigramSimilarity('Шкворень', 'шкворень'), 1);
  assert.equal(trigramSimilarity('тёплый', 'теплый'), 1);
});
