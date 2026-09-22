/**
 * Тесты разбора листа «Запчасти» — docs/technical-spec.md §11.
 *
 * Проверка идёт не на выдуманных строках, а на реальном снимке
 * «Запчасти_с_ценами_рынка (2).xlsx»: 278 позиций, которые лежат в таблице.
 * Так ловятся настоящие особенности данных, а не те, что мы себе представили.
 *
 * Колонки ID в снимке ещё нет (docs/data-model.md §3, открытый вопрос №2),
 * поэтому для тестов она подставляется нумерацией строк — ровно так,
 * как её заведёт оператор: 1..278 в текущем порядке.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readSheet } from '../scripts/xlsx-read.mjs';
import {
  COLUMN,
  classifyArticle,
  collectCategories,
  detectBrands,
  normalizeArticle,
  normalizeTitle,
  parseRow,
  parseSheet,
  toPublic,
} from '../lib/parts.ts';

const SNAPSHOT = 'Запчасти_с_ценами_рынка (2).xlsx';

/** Снимок с проставленной колонкой ID — имитация будущего состояния таблицы. */
function loadRows() {
  const rows = readSheet(SNAPSHOT, 'Запчасти');
  const out = [rows[0]];
  let id = 0;
  for (let i = 1; i < rows.length; i += 1) {
    const cells = [...(rows[i] ?? [])];
    // Ниже данных лист содержит сотни строк с формулами, дающими 0.
    // Оператор проставит ID только там, где есть товар.
    const hasContent =
      (cells[COLUMN.article] ?? '').trim() !== '' ||
      (cells[COLUMN.title] ?? '').trim() !== '' ||
      (cells[COLUMN.category] ?? '').trim() !== '';
    if (!hasContent) continue;
    id += 1;
    cells[COLUMN.id] = String(id);
    out.push(cells);
  }
  return out;
}

const rows = loadRows();
const read = parseSheet(rows, new Date().toISOString());

// --- Целостность данных ----------------------------------------------------

test('снимок содержит ровно 278 заполненных строк', () => {
  // Число зашито литералом намеренно: снимок — фиксированный файл.
  // EXPECTED описывает живую таблицу и меняется вместе с ней,
  // связывать с ним проверку неизменного файла нельзя.
  assert.equal(rows.length - 1, 278);
});

test('на витрину попадают 269 позиций: 262 с маркой и 7 без применимости', () => {
  // 278 всего − 9 чужих марок (ВАЗ 6, ЗИЛ, КамАЗ, МАЗ) = 269.
  assert.equal(read.parts.length, 269);

  const withBrand = read.parts.filter((p) => p.brands.length > 0).length;
  const withoutFitment = read.parts.filter((p) => p.fitment === null).length;
  assert.equal(withBrand, 262);
  assert.equal(withoutFitment, 7);
});

test('позиции ВАЗ, ЗИЛ, КамАЗ и МАЗ не попадают в каталог', () => {
  const foreign = read.parts.filter((p) =>
    /ВАЗ|ЗИЛ|КАМАЗ|МАЗ/i.test((p.fitment ?? '').toUpperCase())
  );
  // «УАЗ/ ГАЗ/ ВАЗ» остаётся: деталь подходит и к УАЗ (решение 7).
  for (const part of foreign) {
    assert.ok(part.brands.length > 0, `ID ${part.id} «${part.fitment}» прошёл без марки ГАЗ/УАЗ`);
  }
  const onlyForeign = read.parts.filter(
    (p) => p.brands.length === 0 && p.fitment !== null
  );
  assert.equal(onlyForeign.length, 0);
});

test('разбор снимка не даёт ошибок', () => {
  const errors = read.issues.filter((i) => i.level === 'error');
  assert.deepEqual(errors, []);
});

test('все цены и остатки — положительные целые', () => {
  for (const part of read.parts) {
    assert.ok(Number.isInteger(part.price) && part.price > 0, `ID ${part.id}: цена ${part.price}`);
    assert.ok(Number.isInteger(part.qty) && part.qty >= 0, `ID ${part.id}: остаток ${part.qty}`);
  }
});

// --- Артикул ---------------------------------------------------------------

test('артикул есть у 185 позиций из 278', () => {
  const all = rows.slice(1);
  const withArticle = all.filter((r) => (r[COLUMN.article] ?? '').trim() !== '');
  assert.equal(withArticle.length, 185);
});

test('кириллический и латинский артикулы нормализуются одинаково', () => {
  // В данных есть 53А170201002 с кириллической А. Механик наберёт латиницей.
  assert.equal(normalizeArticle('53А170201002'), normalizeArticle('53A170201002'));
  // Кириллическая К заменяется на латинскую, Г остаётся: двойника у неё нет.
  assert.equal(normalizeArticle('К126Г'), 'K126Г');
});

test('нормализация убирает разделители, но не меняет порядок знаков', () => {
  assert.equal(normalizeArticle('0469-00-1602558-00'), '046900160255800');
  assert.equal(normalizeArticle('42.3708000-01'), '42370800001');
  assert.equal(normalizeArticle(null), '');
});

test('размеры отличаются от каталожных номеров', () => {
  assert.equal(classifyArticle('42x68x16.4'), 'size');
  assert.equal(classifyArticle('95х130х12х17.5'), 'size'); // кириллическая х
  assert.equal(classifyArticle('4693501070'), 'number');
  assert.equal(classifyArticle('0469-00-1602558-00'), 'number');
  assert.equal(classifyArticle(''), 'none');
  assert.equal(classifyArticle(null), 'none');
});

test('в снимке 24 значения артикула являются размерами', () => {
  const sizes = read.parts.filter((p) => p.articleKind === 'size');
  assert.ok(sizes.length >= 20, `размеров найдено ${sizes.length}, ожидалось около 24`);
});

test('артикул показывается как есть, дефисы не добавляются', () => {
  const long = read.parts.find((p) => (p.article ?? '').length >= 14);
  assert.ok(long, 'в данных есть артикулы длиной 14+ знаков');
  assert.ok(!long.article.includes('-'), 'дефисы расставлены автоматически — это запрещено');
});

// --- Наименование и применимость -------------------------------------------

test('хвостовые пробелы в наименовании срезаются', () => {
  assert.equal(normalizeTitle('Тормозной суппорт УАЗ '), 'Тормозной суппорт УАЗ');
  assert.equal(normalizeTitle('  Муфта  КПП  '), 'Муфта КПП');
});

test('регистр наименования не меняется', () => {
  assert.equal(normalizeTitle('муфта скользящая фланца'), 'муфта скользящая фланца');
});

test('марка определяется подстрокой во всех написаниях источника', () => {
  assert.deepEqual(detectBrands('УАЗ'), ['УАЗ']);
  assert.deepEqual(detectBrands('Уаз'), ['УАЗ']);
  assert.deepEqual(detectBrands('Газель'), ['ГАЗ']);
  assert.deepEqual(detectBrands('ГАЗ 66,3308'), ['ГАЗ']);
  assert.deepEqual(detectBrands('УАЗ/ ГАЗ'), ['ГАЗ', 'УАЗ']);
  assert.deepEqual(detectBrands('УАЗ/ГАЗ'), ['ГАЗ', 'УАЗ']);
  assert.deepEqual(detectBrands('ВАЗ'), []);
  assert.deepEqual(detectBrands(null), []);
});

test('строка применимости сохраняется как есть', () => {
  // «УАЗ/ ГАЗ» не превращается в «УАЗ · ГАЗ»: текст правит оператор (решение 10).
  const part = read.parts.find((p) => p.fitment === 'УАЗ/ ГАЗ');
  assert.ok(part, 'написание «УАЗ/ ГАЗ» присутствует в данных без изменений');
});

// --- Категории -------------------------------------------------------------

test('категории берутся из данных, их восемь', () => {
  const all = parseSheet(rows, '').parts;
  const categories = collectCategories(all.map(toPublic));
  const names = categories.map((c) => c.name);
  assert.ok(names.includes('Подвеска'));
  assert.ok(names.includes('Двигатель'));
  assert.ok(categories.length <= 8, `категорий ${categories.length}, в данных их 8`);
  // Первая — самая крупная.
  assert.equal(categories[0].name, 'Подвеска');
});

// --- Обязательные поля строки ----------------------------------------------

test('строка без ID отклоняется, а не получает номер на лету', () => {
  const cells = [];
  cells[COLUMN.title] = 'Шкворень';
  cells[COLUMN.price] = '5000';
  cells[COLUMN.qty] = '4';
  cells[COLUMN.category] = 'Подвеска';
  const result = parseRow(cells, 42);
  assert.equal(result.ok, false);
  assert.match(result.reason, /ID/);
});

test('строка без цены или остатка отклоняется, ноль не подставляется', () => {
  const base = [];
  base[COLUMN.id] = '10';
  base[COLUMN.title] = 'Шкворень';
  base[COLUMN.category] = 'Подвеска';

  const noPrice = [...base];
  noPrice[COLUMN.qty] = '4';
  assert.equal(parseRow(noPrice, 5).ok, false);

  const noQty = [...base];
  noQty[COLUMN.price] = '5000';
  assert.equal(parseRow(noQty, 5).ok, false);
});

test('повторяющийся ID — ошибка листа', () => {
  const header = rows[0];
  const row = [...rows[1]];
  const duplicate = [...rows[2]];
  duplicate[COLUMN.id] = row[COLUMN.id];
  const result = parseSheet([header, row, duplicate], '');
  assert.equal(result.parts.length, 1);
  assert.ok(result.issues.some((i) => i.level === 'error' && /уже встречался/.test(i.reason)));
});

// --- Публичный контракт ----------------------------------------------------

test('публичный срез не содержит закупочных и рыночных полей', () => {
  const json = JSON.stringify(read.parts.map(toPublic));
  for (const forbidden of ['cost', 'market', 'priceNote', 'row', 'articleNorm']) {
    assert.ok(!json.includes(forbidden), `в публичном ответе найдено «${forbidden}»`);
  }
});

test('публичная позиция содержит ровно девять полей контракта', () => {
  const keys = Object.keys(toPublic(read.parts[0])).sort();
  assert.deepEqual(keys, [
    'article',
    'articleKind',
    'brands',
    'category',
    'fitment',
    'id',
    'price',
    'qty',
    'title',
  ]);
});

// --- Дубли артикулов -------------------------------------------------------

test('три известных дубля артикула остаются разными позициями', () => {
  for (const article of ['211009070', '521701111', '4171000150']) {
    const found = read.parts.filter((p) => p.articleNorm === normalizeArticle(article));
    assert.equal(found.length, 2, `артикул ${article} должен встречаться дважды`);
    assert.notEqual(found[0].id, found[1].id, 'у дублей разные ключи');
  }
});
