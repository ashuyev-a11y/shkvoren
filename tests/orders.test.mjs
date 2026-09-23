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
  COMMENT_MAX,
  OrderError,
  buildLines,
  normalizeComment,
  buildOrder,
  buildOrderNo,
  buildRow,
  effectiveTotal,
  listTotal,
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

test('строка листа содержит одиннадцать колонок в порядке A..K', () => {
  const lines = buildLines([{ id: 1, qty: 2 }, { id: 2, qty: 1 }], PARTS);
  const row = buildRow({
    orderNo: 'ШКВ-0001',
    createdAt: '2026-09-20T14:31:05+05:00',
    phone: '+7 701 111 22 33',
    lines,
    total: orderTotal(lines),
    offeredTotal: null,
    status: 'новый',
  });

  // Колонки I и J добавлены вместе с торгом (решение 18), K — комментарий (18.1).
  assert.equal(row.length, 11);
  assert.equal(row[0], 'ШКВ-0001');
  assert.equal(row[1], '2026-09-20T14:31:05+05:00');
  assert.equal(row[2], '+7 701 111 22 33');
  assert.equal(row[3], '2');
  assert.equal(row[4], '47500');
  assert.equal(row[5], '1x2; 2x1');
  assert.equal(row[7], 'новый');
  // Торга не было: колонка предложения пуста, итог по прайсу равен общему.
  assert.equal(row[8], '');
  assert.equal(row[9], '47500');
  // Комментария не было — колонка K пуста.
  assert.equal(row[10], '');
});

test('читаемый состав содержит название каждой позиции', () => {
  const lines = buildLines([{ id: 1, qty: 2 }, { id: 2, qty: 1 }], PARTS);
  const row = buildRow({
    orderNo: 'ШКВ-0001',
    createdAt: uralskTimestamp(),
    phone: '+7 701 111 22 33',
    lines,
    total: orderTotal(lines),
    offeredTotal: null,
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
    offeredTotal: null,
    status: 'новый',
  });
  assert.equal(row[4], '40000');
  assert.ok(Number.isFinite(Number(row[4])));
});

// --- Предложение цены (решение 18) -----------------------------------------

test('построчное предложение участвует в расчёте строки и итога', () => {
  // Прайс 20 000 × 2 = 40 000. Покупатель предлагает 15 000 за штуку.
  const lines = buildLines([{ id: 1, qty: 2, offeredPrice: 15000 }], PARTS);

  assert.equal(lines[0].price, 20000, 'прайсовая цена сохраняется как есть');
  assert.equal(lines[0].offeredPrice, 15000);
  assert.equal(lines[0].sum, 30000, 'сумма строки считается по предложенной цене');

  assert.equal(orderTotal(lines), 30000);
  assert.equal(listTotal(lines), 40000, 'итог по прайсу остаётся доступен');
});

test('позиция без предложения считается по прайсу', () => {
  const lines = buildLines([{ id: 1, qty: 2 }, { id: 2, qty: 1, offeredPrice: 5000 }], PARTS);

  assert.equal(lines[0].offeredPrice, null);
  assert.equal(lines[0].sum, 40000);
  assert.equal(lines[1].sum, 5000);
  assert.equal(orderTotal(lines), 45000);
  assert.equal(listTotal(lines), 47500);
});

test('предложение ниже себестоимости допускается', () => {
  // Отсечки по проценту нет намеренно: цена в таблице и так себестоимость
  // (решение 0), поэтому предложение ниже неё — осознанный торг.
  const lines = buildLines([{ id: 1, qty: 1, offeredPrice: 1 }], PARTS);
  assert.equal(lines[0].sum, 1);
});

test('нецелое и неположительное предложение отклоняются', () => {
  assert.throws(() => buildLines([{ id: 1, qty: 1, offeredPrice: 0 }], PARTS), OrderError);
  assert.throws(() => buildLines([{ id: 1, qty: 1, offeredPrice: -5 }], PARTS), OrderError);
  assert.throws(() => buildLines([{ id: 1, qty: 1, offeredPrice: 10.5 }], PARTS), OrderError);
});

test('сумма за весь заказ побеждает построчные предложения', () => {
  const lines = buildLines([{ id: 1, qty: 2, offeredPrice: 15000 }, { id: 2, qty: 1 }], PARTS);

  // Построчно вышло бы 30 000 + 7 500 = 37 500, но покупатель торгуется
  // за партию целиком — одна цифра отменяет разбивку.
  assert.equal(orderTotal(lines), 37500);
  assert.equal(effectiveTotal(lines, 25000), 25000);
  assert.equal(effectiveTotal(lines, null), 37500, 'без суммы за заказ считаем по строкам');
});

test('при сумме за заказ построчные предложения не теряются', () => {
  const lines = buildLines([{ id: 1, qty: 2, offeredPrice: 15000 }, { id: 2, qty: 1 }], PARTS);
  const row = buildRow({
    orderNo: 'ШКВ-0003',
    createdAt: uralskTimestamp(),
    phone: '+7 701 111 22 33',
    lines,
    total: effectiveTotal(lines, 25000),
    offeredTotal: 25000,
    status: 'новый',
  });

  // Колонка E — сумма, которую покупатель предлагает заплатить.
  assert.equal(row[4], '25000');
  // Колонка I — предложение за заказ, J — итог по прайсу.
  assert.equal(row[8], '25000');
  assert.equal(row[9], '47500');
  // Построчное предложение видно и в машинном, и в читаемом составе.
  assert.equal(row[5], '1x2@15000; 2x1');
  assert.match(row[6], /\(предложено: /);
});

test('buildOrder проверяет сумму за заказ и считает итог', () => {
  const lines = buildLines([{ id: 1, qty: 1 }], PARTS);

  const bargained = buildOrder(lines, '+7 701 111 22 33', 1, 12000);
  assert.equal(bargained.total, 12000);
  assert.equal(bargained.offeredTotal, 12000);

  const plain = buildOrder(lines, '+7 701 111 22 33', 1);
  assert.equal(plain.total, 20000);
  assert.equal(plain.offeredTotal, null, 'по умолчанию торга нет');

  assert.throws(() => buildOrder(lines, '', 1, 0), OrderError);
  assert.throws(() => buildOrder(lines, '', 1, 10.5), OrderError);
});

// --- Комментарий к заказу (решение 18.1) ------------------------------------

test('пустой комментарий не пишется в таблицу', () => {
  const lines = buildLines([{ id: 1, qty: 1 }], PARTS);
  for (const empty of [null, undefined, '', '   ', '\n\t']) {
    const order = buildOrder(lines, '+7 701 111 22 33', 1, null, empty);
    assert.equal(order.comment, '');
    assert.equal(buildRow(order)[10], '', 'колонка K пуста');
  }
});

test('заполненный комментарий пишется в колонку K', () => {
  const lines = buildLines([{ id: 1, qty: 1 }], PARTS);
  const order = buildOrder(lines, '+7 701 111 22 33', 1, null, '  Заберу\nв субботу  ');
  // Переносы схлопнуты, крайние пробелы сняты: в ячейке одна строка.
  assert.equal(order.comment, 'Заберу в субботу');
  assert.equal(buildRow(order)[10], 'Заберу в субботу');
});

test('длинный комментарий обрезается, а не отклоняет заказ', () => {
  assert.equal(normalizeComment('я'.repeat(COMMENT_MAX + 50)).length, COMMENT_MAX);
});
