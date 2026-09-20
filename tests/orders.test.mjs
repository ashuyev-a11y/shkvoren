/**
 * Тесты сборки заказа — docs/technical-spec.md §11.
 *
 * Проверяются чистые функции: номер, строки заказа, состав строки листа.
 * Запись в таблицу здесь не трогается — для неё нужен реальный доступ,
 * её проверяет scripts/check-sheet.mjs вручную перед деплоем.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  OrderError,
  buildLines,
  buildOrderNo,
  buildRow,
  orderTotal,
  uralskTimestamp,
} from '../lib/orders.ts';

/** Каталог из двух позиций: с артикулом и без него. */
const PARTS = [
  {
    id: 1,
    title: 'Задний тормозной барабан',
    article: '4693501070',
    articleKind: 'number',
    fitment: 'УАЗ Буханка',
    brands: ['УАЗ'],
    category: 'Тормоза',
    price: 20000,
    qty: 13,
    row: 2,
    articleNorm: '4693501070',
    costPrice: null,
    marketPrice: null,
    marketDelta: null,
    priceNote: null,
  },
  {
    id: 2,
    title: 'Тормозной щит',
    article: null,
    articleKind: 'none',
    fitment: 'УАЗ',
    brands: ['УАЗ'],
    category: 'Тормоза',
    price: 7500,
    qty: 2,
    row: 3,
    articleNorm: '',
    costPrice: null,
    marketPrice: null,
    marketDelta: null,
    priceNote: null,
  },
];

// --- Номер заказа ----------------------------------------------------------

test('первый заказ получает номер ШКВ-0001', () => {
  // В пустом листе есть только строка заголовков.
  assert.equal(buildOrderNo(1), 'ШКВ-0001');
});

test('номер растёт вместе с числом строк листа', () => {
  assert.equal(buildOrderNo(2), 'ШКВ-0002');
  assert.equal(buildOrderNo(12), 'ШКВ-0012');
  assert.equal(buildOrderNo(1234), 'ШКВ-1234');
});

test('номер не ломается на пустом листе без заголовка', () => {
  assert.equal(buildOrderNo(0), 'ШКВ-0001');
});

// --- Время -----------------------------------------------------------------

test('время записывается в часовом поясе Уральска', () => {
  const stamp = uralskTimestamp(new Date('2026-09-20T09:31:05Z'));
  assert.equal(stamp, '2026-09-20T14:31:05+05:00');
});

// --- Позиции ---------------------------------------------------------------

test('цена берётся из каталога, а не из запроса', () => {
  // Браузер мог прислать что угодно — в OrderDraftItem цены нет вовсе.
  const lines = buildLines([{ id: 1, qty: 2 }], PARTS);
  assert.equal(lines[0].price, 20000);
  assert.equal(lines[0].sum, 40000);
});

test('итог считается по ценам каталога', () => {
  const lines = buildLines([{ id: 1, qty: 2 }, { id: 2, qty: 1 }], PARTS);
  assert.equal(orderTotal(lines), 47500);
});

test('количество больше остатка отклоняется', () => {
  assert.throws(
    () => buildLines([{ id: 2, qty: 3 }], PARTS),
    (error) => error instanceof OrderError && /в наличии 2 шт/.test(error.message)
  );
});

test('количество ровно по остатку допускается', () => {
  const lines = buildLines([{ id: 2, qty: 2 }], PARTS);
  assert.equal(lines[0].qty, 2);
});

test('нулевое и дробное количество отклоняются', () => {
  assert.throws(() => buildLines([{ id: 1, qty: 0 }], PARTS), OrderError);
  assert.throws(() => buildLines([{ id: 1, qty: 1.5 }], PARTS), OrderError);
  assert.throws(() => buildLines([{ id: 1, qty: -1 }], PARTS), OrderError);
});

test('несуществующая позиция отклоняется', () => {
  assert.throws(
    () => buildLines([{ id: 999, qty: 1 }], PARTS),
    (error) => error instanceof OrderError && /больше не продаётся/.test(error.message)
  );
});

test('пустая корзина отклоняется', () => {
  assert.throws(() => buildLines([], PARTS), OrderError);
});

// --- Строка листа ----------------------------------------------------------

test('строка листа содержит восемь колонок в порядке A..H', () => {
  const lines = buildLines([{ id: 1, qty: 2 }, { id: 2, qty: 1 }], PARTS);
  const row = buildRow({
    orderNo: 'ШКВ-0001',
    createdAt: '2026-09-20T14:31:05+05:00',
    phone: '+7 701 111 22 33',
    lines,
    total: orderTotal(lines),
    status: 'новый',
  });

  assert.equal(row.length, 8);
  assert.equal(row[0], 'ШКВ-0001');
  assert.equal(row[1], '2026-09-20T14:31:05+05:00');
  assert.equal(row[2], '+7 701 111 22 33');
  assert.equal(row[3], '2');
  assert.equal(row[4], '47500');
  assert.equal(row[5], '1x2; 2x1');
  assert.equal(row[7], 'новый');
});

test('читаемый состав содержит название каждой позиции', () => {
  const lines = buildLines([{ id: 1, qty: 2 }, { id: 2, qty: 1 }], PARTS);
  const row = buildRow({
    orderNo: 'ШКВ-0001',
    createdAt: uralskTimestamp(),
    phone: '+7 701 111 22 33',
    lines,
    total: orderTotal(lines),
    status: 'новый',
  });

  assert.match(row[6], /4693501070 — Задний тормозной барабан, 2 шт/);
  // Позиция без артикула начинается с названия.
  assert.match(row[6], /\nТормозной щит, 1 шт/);
});

test('итог в строке листа — число без разделителей', () => {
  // В колонку E пишется машинное значение: таблица должна уметь его суммировать.
  const lines = buildLines([{ id: 1, qty: 2 }], PARTS);
  const row = buildRow({
    orderNo: 'ШКВ-0002',
    createdAt: uralskTimestamp(),
    phone: '',
    lines,
    total: orderTotal(lines),
    status: 'новый',
  });
  assert.equal(row[4], '40000');
  assert.ok(Number.isFinite(Number(row[4])));
});
