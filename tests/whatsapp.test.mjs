/**
 * Тесты сообщения WhatsApp — docs/technical-spec.md §11.
 *
 * Шаблон зафиксирован решением 12 и помечен там как протестированный,
 * поэтому проверка идёт посимвольно: любое лишнее слово, эмодзи или
 * переставленная строка — провал теста, а не «улучшение формулировки».
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildMessage, buildWhatsappUrl } from '../lib/whatsapp.ts';

const THIN_NBSP = '\u202F';

/** Цена в том же виде, в котором её печатает витрина. */
const price = (value) =>
  `${String(value).replace(/\B(?=(\d{3})+(?!\d))/g, THIN_NBSP)}${THIN_NBSP}₸`;

/** Позиции взяты из снимка таблицы: реальные названия, номера и цены. */
const LINES = [
  {
    id: 1,
    title: 'Задний тормозной барабан',
    article: '4693501070',
    qty: 2,
    price: 20000,
    sum: 40000,
  },
  {
    id: 2,
    title: 'Тормозной щит',
    article: null,
    qty: 1,
    price: 7500,
    sum: 7500,
  },
];

test('обращение без позиций совпадает с решением 12', () => {
  assert.equal(
    buildMessage([], '+7 701 111 22 33'),
    'Здравствуйте! Интересует распродажа склада ГАЗ/УАЗ по себестоимости.\n' +
      'Мой телефон: +7 701 111 22 33'
  );
});

test('сообщение с позициями совпадает с решением 12', () => {
  assert.equal(
    buildMessage(LINES, '+7 701 111 22 33'),
    'Здравствуйте! Хочу заказать по распродаже склада:\n' +
      `4693501070 — Задний тормозной барабан, 2 шт x ${price(20000)} = ${price(40000)}\n` +
      `Тормозной щит, 1 шт x ${price(7500)} = ${price(7500)}\n` +
      `Итого: ${price(47500)}\n` +
      'Мой телефон: +7 701 111 22 33'
  );
});

test('без телефона строка «Мой телефон» отсутствует', () => {
  const text = buildMessage(LINES, '');
  assert.ok(!text.includes('Мой телефон'));
  assert.ok(text.endsWith(`Итого: ${price(47500)}`));
});

test('пробелы вместо телефона не создают пустую строку', () => {
  assert.ok(!buildMessage([], '   ').includes('Мой телефон'));
});

test('позиция без артикула начинается с названия', () => {
  const text = buildMessage([LINES[1]], '');
  assert.match(text, /\nТормозной щит, 1 шт/);
  // «номер не указан» — надпись для витрины, продавцу в сообщении она не нужна.
  assert.ok(!text.includes('номер не указан'));
});

test('в сообщении нет эмодзи и восклицаний сверх шаблона', () => {
  const text = buildMessage(LINES, '+7 701 111 22 33');
  // Единственный восклицательный знак — в слове «Здравствуйте!» из решения 12.
  assert.equal((text.match(/!/g) ?? []).length, 1);
  assert.ok(!/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(text), 'найдены эмодзи');
});

test('номер заказа в текст не подставляется', () => {
  // Шаблон решения 12 его не содержит; номер живёт в листе и на бланке.
  assert.ok(!buildMessage(LINES, '').includes('ШКВ-'));
});

test('ссылка собирается из переменной окружения', () => {
  process.env.NEXT_PUBLIC_WHATSAPP_NUMBER = '77010000000';
  const url = buildWhatsappUrl(LINES, '+7 701 111 22 33');
  assert.ok(url.startsWith('https://wa.me/77010000000?text='));

  // Текст должен восстанавливаться из ссылки без потерь.
  const decoded = decodeURIComponent(url.slice(url.indexOf('?text=') + 6));
  assert.equal(decoded, buildMessage(LINES, '+7 701 111 22 33'));
});

test('отсутствие номера продавца — ошибка, а не пустая ссылка', () => {
  const saved = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER;
  process.env.NEXT_PUBLIC_WHATSAPP_NUMBER = '';
  assert.throws(() => buildWhatsappUrl([], ''), /NEXT_PUBLIC_WHATSAPP_NUMBER/);
  process.env.NEXT_PUBLIC_WHATSAPP_NUMBER = saved;
});
