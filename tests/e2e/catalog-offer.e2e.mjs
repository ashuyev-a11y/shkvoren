/**
 * Сквозной тест витрины (каталога на главной) — решение 18.1.
 *
 * Покупатель предлагает свою цену прямо в строке каталога, не заходя
 * в карточку и не открывая корзину. Проверяется настоящая страница «/»
 * в системном Chrome. Заодно тест ловит перекрытие кнопок строки
 * растянутой ссылкой: раньше клик по «+» и «В заказ» на десктопе
 * открывал карточку.
 *
 * В `npm test` не входит: нужен запущенный сайт. Запуск:
 *   npm run test:e2e                                    — против прода
 *   E2E_BASE_URL=http://localhost:3000 npm run test:e2e — против next start
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';

const BASE = (process.env.E2E_BASE_URL ?? 'https://shkvoren-mu.vercel.app').replace(/\/$/, '');

const VIEWPORTS = [
  ['десктоп', { width: 1280, height: 900 }],
  ['телефон', { width: 390, height: 844 }],
];

for (const [name, viewport] of VIEWPORTS) {
  test(`витрина / (${name}): цена из строки каталога уходит в корзину`, async () => {
    const browser = await chromium.launch({ channel: 'chrome' });
    try {
      const page = await browser.newPage({ viewport });
      await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });

      // Строка фиксируется по номеру: после раскрытия поля «первая ссылка»
      // на странице уже другая, и локатор по ней съехал бы на соседнюю строку.
      const row = page.locator('main li').nth(4);
      await row.scrollIntoViewIfNeeded();
      const title = (await row.locator('a').first().innerText()).trim();

      // 1. Ссылка есть в строке, поле до клика скрыто.
      const link = row.getByRole('button', { name: 'Предложить свою цену' });
      assert.equal(await link.count(), 1, 'ссылка в строке каталога');
      const input = row.getByLabel(`Ваша цена за шт: ${title}`);
      assert.equal(await input.count(), 0, 'поле скрыто до клика');

      // 2. Клик раскрывает поле и не уводит на карточку.
      await link.click();
      assert.equal(new URL(page.url()).pathname, '/', 'клик по ссылке не открыл карточку');
      assert.ok(await input.isVisible(), 'поле раскрылось');

      // 3. Цена уходит в корзину вместе с позицией; «В заказ» не открывает карточку.
      await input.fill('123');
      await row.getByRole('button', { name: 'В заказ', exact: true }).click();
      await page.waitForFunction(() => localStorage.getItem('shkvoren-cart')?.includes('"qty":1'));
      assert.equal(new URL(page.url()).pathname, '/', '«В заказ» не открыл карточку');

      const cart = JSON.parse(
        await page.evaluate(() => localStorage.getItem('shkvoren-cart'))
      ).state;
      assert.equal(cart.items.length, 1);
      assert.equal(cart.items[0].title, title);
      assert.equal(cart.items[0].offeredPrice, 123, 'предложенная цена записана в позицию');
      assert.ok(cart.items[0].price > 0, 'прайс сохранён рядом');

      // 4. «+» в строке тоже работает, а не открывает карточку.
      // Доступное имя кнопки — aria-label из QuantityControl, а не символ «+».
      await row.getByRole('button', { name: `Добавить одну штуку: ${title}` }).click();
      await page.waitForFunction(() => localStorage.getItem('shkvoren-cart')?.includes('"qty":2'));
      assert.equal(new URL(page.url()).pathname, '/', '«+» не открыл карточку');
    } finally {
      await browser.close();
    }
  });
}
