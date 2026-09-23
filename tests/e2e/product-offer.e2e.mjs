/**
 * Сквозной тест карточки товара — решение 18.1, задача 16.
 *
 * Зачем отдельно от tests/*.test.mjs: тесты задачи 15 проверяли только стор
 * корзины (setQty с третьим аргументом) и ни разу не открывали страницу
 * /product/:id. Зелёный стор не доказывает, что ссылка есть на странице.
 * Этот тест открывает настоящую страницу в настоящем Chrome.
 *
 * В `npm test` не входит: ему нужен запущенный сайт и браузер. Запуск:
 *   npm run test:e2e                                  — против прода
 *   E2E_BASE_URL=http://localhost:3000 npm run test:e2e — против next start
 *
 * Браузер — установленный в системе Chrome (channel 'chrome'), свой
 * Chromium playwright-core не скачивает.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';

const BASE = (process.env.E2E_BASE_URL ?? 'https://shkvoren-mu.vercel.app').replace(/\/$/, '');

/**
 * Позиция для проверки. Id 9 — «Болт картера моста», 300 ₸, есть в живой
 * таблице. Если её снимут с витрины, задайте E2E_PRODUCT_ID.
 */
const PRODUCT_ID = Number(process.env.E2E_PRODUCT_ID ?? 9);

/** Ширины из проверки на проде: десктоп и телефон. */
const VIEWPORTS = [
  ['десктоп', { width: 1280, height: 900 }],
  ['телефон', { width: 390, height: 844 }],
];

for (const [name, viewport] of VIEWPORTS) {
  test(`карточка /product/${PRODUCT_ID} (${name}): предложенная цена уходит в корзину`, async () => {
    const browser = await chromium.launch({ channel: 'chrome' });
    try {
      const page = await browser.newPage({ viewport });
      await page.goto(`${BASE}/product/${PRODUCT_ID}`, { waitUntil: 'networkidle' });

      // Прайс берём со страницы, а не из константы: тест не должен ломаться
      // от смены цены в таблице.
      const saved = () => page.evaluate(() => localStorage.getItem('shkvoren-cart'));
      assert.equal(await saved(), null, 'новый контекст начинается с пустой корзины');

      // 1. Ссылка есть и по умолчанию свёрнута — поля ещё нет.
      const link = page.getByRole('button', { name: 'Предложить свою цену' });
      assert.equal(await link.count(), 1, 'ссылка «Предложить свою цену» на карточке');
      assert.equal(await page.getByLabel('Ваша цена за шт').count(), 0, 'поле скрыто до клика');

      // 2. Клик раскрывает поле.
      await link.click();
      const input = page.getByLabel('Ваша цена за шт');
      assert.ok(await input.isVisible(), 'поле «Ваша цена за шт» раскрылось');

      // 3. Ноль — не цена: показывается ошибка, торга нет.
      await input.fill('0');
      assert.ok(
        await page.getByText('Укажите целое число больше нуля.').isVisible(),
        'ноль отклоняется подсказкой'
      );

      // 4. Нормальная цена уходит в корзину вместе с позицией.
      await input.fill('250');
      await page.getByRole('button', { name: 'В заказ', exact: true }).click();
      await page.waitForFunction(() => localStorage.getItem('shkvoren-cart')?.includes('"qty":1'));

      const cart = JSON.parse(await saved()).state;
      assert.equal(cart.items.length, 1);
      assert.equal(cart.items[0].id, PRODUCT_ID);
      assert.equal(cart.items[0].qty, 1);
      assert.equal(cart.items[0].offeredPrice, 250, 'предложенная цена записана в позицию');
      assert.ok(cart.items[0].price > 0, 'прайс сохранён рядом');

      // 5. Корзина считает итог по предложенной цене и показывает прайс.
      await page.goto(`${BASE}/cart`, { waitUntil: 'networkidle' });
      const text = (await page.locator('main').innerText()).replace(/\s+/g, ' ');
      assert.match(text, /Ваше предложение 250\s₸/);
      assert.match(text, /По прайсу /);
    } finally {
      await browser.close();
    }
  });
}
