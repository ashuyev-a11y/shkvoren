/**
 * Тесты уведомления продавца — решение 17.
 *
 * Главное здесь не текст, а поведение при отказе: заказ к моменту вызова
 * уже записан в лист, и падение Telegram не имеет права превратиться
 * в ошибку у покупателя.
 *
 * fetch подменяется на время теста: настоящий вызов Bot API в тестах
 * недопустим — он ушёл бы в рабочий чат продавца.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildNotification, notifyNewOrder } from '../lib/telegram.ts';

/** Заказ из снимка таблицы: реальные названия, номера и цены. */
const ORDER = {
  orderNo: 'ШКВ-0007',
  createdAt: '2026-09-21T12:04:14+05:00',
  phone: '+7 701 111 22 33',
  lines: [
    {
      id: 1,
      title: 'Задний тормозной барабан',
      article: '4693501070',
      qty: 2,
      price: 20000,
      sum: 40000,
    },
    { id: 2, title: 'Тормозной щит', article: null, qty: 1, price: 7500, sum: 7500 },
  ],
  total: 47500,
  status: 'новый',
};

/** Подменить fetch и окружение на время одного вызова. */
async function withFetch(handler, run) {
  const realFetch = globalThis.fetch;
  const realToken = process.env.TELEGRAM_BOT_TOKEN;
  const realChat = process.env.TELEGRAM_CHAT_ID;

  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    return handler();
  };
  // Значения подставные: настоящий токен в тестах не нужен и опасен.
  process.env.TELEGRAM_BOT_TOKEN = '000:TEST';
  process.env.TELEGRAM_CHAT_ID = '-1001';

  try {
    const result = await run();
    return { calls, result };
  } finally {
    globalThis.fetch = realFetch;
    if (realToken === undefined) delete process.env.TELEGRAM_BOT_TOKEN;
    else process.env.TELEGRAM_BOT_TOKEN = realToken;
    if (realChat === undefined) delete process.env.TELEGRAM_CHAT_ID;
    else process.env.TELEGRAM_CHAT_ID = realChat;
  }
}

const ok = () => new Response('{"ok":true}', { status: 200 });

test('уведомление уходит на sendMessage с ожидаемым телом', async () => {
  const { calls, result } = await withFetch(ok, () => notifyNewOrder(ORDER));

  assert.equal(result, true);
  assert.equal(calls.length, 1, 'при успехе повтора быть не должно');
  assert.equal(calls[0].url, 'https://api.telegram.org/bot000:TEST/sendMessage');
  assert.equal(calls[0].options.method, 'POST');

  const body = JSON.parse(calls[0].options.body);
  assert.equal(body.chat_id, '-1001');
  assert.equal(body.text, buildNotification(ORDER));
});

test('отказ Telegram не бросает исключение', async () => {
  // 500: сервер Telegram лежит. Повтор оправдан, но результат тот же.
  const { calls, result } = await withFetch(
    () => new Response('{"ok":false}', { status: 500 }),
    () => notifyNewOrder(ORDER)
  );

  assert.equal(result, false);
  assert.equal(calls.length, 2, 'одна повторная попытка, не больше');
});

test('ошибка 4xx не повторяется', async () => {
  // Неверный chat_id или бот не в группе: тело и адрес те же,
  // ответ не изменится — повтор только тратит время заказа.
  const { calls, result } = await withFetch(
    () => new Response('{"ok":false,"description":"chat not found"}', { status: 400 }),
    () => notifyNewOrder(ORDER)
  );

  assert.equal(result, false);
  assert.equal(calls.length, 1);
});

test('обрыв соединения не бросает исключение', async () => {
  const { result } = await withFetch(
    () => {
      throw new Error('соединение разорвано');
    },
    () => notifyNewOrder(ORDER)
  );

  assert.equal(result, false);
});

test('без переменных окружения уведомление не отправляется', async () => {
  const realFetch = globalThis.fetch;
  const realToken = process.env.TELEGRAM_BOT_TOKEN;
  let called = false;
  globalThis.fetch = async () => {
    called = true;
    return ok();
  };
  delete process.env.TELEGRAM_BOT_TOKEN;

  try {
    assert.equal(await notifyNewOrder(ORDER), false);
    assert.equal(called, false, 'запроса без токена быть не должно');
  } finally {
    globalThis.fetch = realFetch;
    if (realToken !== undefined) process.env.TELEGRAM_BOT_TOKEN = realToken;
  }
});

test('текст содержит номер заказа, состав, итог и телефон', () => {
  const text = buildNotification(ORDER);

  assert.match(text, /^Новый заказ ШКВ-0007\n/);
  assert.ok(text.includes('4693501070 — Задний тормозной барабан, 2 шт x'));
  // Позиция без артикула начинается с названия.
  assert.match(text, /\nТормозной щит, 1 шт x/);
  assert.ok(text.includes('Телефон покупателя: +7 701 111 22 33'));
  assert.ok(text.trim().length > 0);
});

test('состав совпадает со строками сообщения WhatsApp', async () => {
  // Решение 17: продавец видит один и тот же состав в обоих каналах.
  const { buildMessage } = await import('../lib/whatsapp.ts');
  const whatsapp = buildMessage(ORDER.lines, ORDER.phone);
  const telegram = buildNotification(ORDER);

  for (const line of ORDER.lines) {
    const head = line.article ? `${line.article} — ${line.title}` : line.title;
    const row = whatsapp.split('\n').find((r) => r.startsWith(head));
    assert.ok(row, 'строка позиции есть в сообщении WhatsApp');
    assert.ok(telegram.includes(row), `строка «${head}» совпадает в обоих каналах`);
  }
});

test('пустой телефон не создаёт пустую строку', () => {
  const text = buildNotification({ ...ORDER, phone: '   ' });
  assert.ok(!text.includes('Телефон покупателя'));
});

// --- Предложение цены (решение 18) -----------------------------------------

/** Тот же заказ, но по первой позиции покупатель предложил свою цену. */
const BARGAINED = {
  ...ORDER,
  lines: [
    { ...ORDER.lines[0], offeredPrice: 15000, sum: 30000 },
    { ...ORDER.lines[1], offeredPrice: null },
  ],
  total: 37500,
  offeredTotal: null,
};

test('заказ без торга идёт без пометки', () => {
  const text = buildNotification({ ...ORDER, offeredTotal: null });

  assert.match(text, /^Новый заказ ШКВ-0007\n/);
  assert.ok(!text.includes('предложил цену'));
  assert.ok(text.includes('Итого: '));
});

test('построчное предложение поднимает пометку в начало сообщения', () => {
  const text = buildNotification(BARGAINED);

  // Пометка первой строкой: иначе продавец подтвердит заказ «по прайсу»,
  // не заметив, что сумма другая.
  assert.match(text, /^💬 Покупатель предложил цену\nНовый заказ ШКВ-0007\n/);
  assert.ok(text.includes('(предложено: '));
  assert.ok(text.includes('Итого по прайсу: '));
  assert.ok(text.includes('Итого (предложение покупателя): '));
});

test('сумма за весь заказ тоже поднимает пометку', () => {
  const text = buildNotification({
    ...ORDER,
    lines: ORDER.lines.map((line) => ({ ...line, offeredPrice: null })),
    total: 25000,
    offeredTotal: 25000,
  });

  assert.match(text, /^💬 Покупатель предложил цену\n/);
  // Построчных пометок здесь нет: торговались за заказ целиком.
  assert.ok(!text.includes('(предложено: '));
  assert.ok(text.includes('Итого (предложение покупателя): '));
});

test('предложенные цены доходят до Telegram в теле запроса', async () => {
  const { calls, result } = await withFetch(ok, () => notifyNewOrder(BARGAINED));

  assert.equal(result, true);
  const body = JSON.parse(calls[0].options.body);
  assert.ok(body.text.startsWith('💬 Покупатель предложил цену'));
  assert.equal(body.text, buildNotification(BARGAINED));
});

test('состав с торгом совпадает со строками сообщения WhatsApp', async () => {
  const { buildMessage } = await import('../lib/whatsapp.ts');
  const whatsapp = buildMessage(BARGAINED.lines, BARGAINED.phone);
  const telegram = buildNotification(BARGAINED);

  for (const line of BARGAINED.lines) {
    const head = line.article ? `${line.article} — ${line.title}` : line.title;
    const row = whatsapp.split('\n').find((r) => r.startsWith(head));
    assert.ok(row, 'строка позиции есть в сообщении WhatsApp');
    assert.ok(telegram.includes(row), `строка «${head}» совпадает в обоих каналах`);
  }
});
