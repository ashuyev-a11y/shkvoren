/**
 * Тесты корзины — восстановление из localStorage.
 *
 * Проверяется одно, но критичное: флаг hydrated обязан подняться при любом
 * состоянии хранилища. Пока он ложный, страница заказа показывает
 * «Загружаем заказ…» и не открывается вовсе — именно это и случилось
 * в продакшене.
 *
 * Стор создаётся заново на каждый случай: persist читает хранилище один раз,
 * при импорте модуля.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

/** Подставить localStorage и получить свежий экземпляр стора. */
async function loadCart(storage, label) {
  globalThis.window = { localStorage: storage };
  const cart = await import(`../lib/cart.ts?${encodeURIComponent(label)}`);
  // Восстановление асинхронное: ждём следующего тика.
  await new Promise((resolve) => setTimeout(resolve, 30));
  return cart.useCart.getState();
}

const empty = { getItem: () => null, setItem() {}, removeItem() {} };

test('сохранённая корзина восстанавливается', async () => {
  const saved = JSON.stringify({
    state: { items: [{ id: 1, title: 'Бегунок', article: null, articleKind: 'none', price: 1000, qty: 2, stock: 6 }], phone: '+7 777 000 00 00' },
    version: 0,
  });

  const state = await loadCart(
    { getItem: () => saved, setItem() {}, removeItem() {} },
    'saved'
  );

  assert.equal(state.hydrated, true);
  assert.equal(state.items.length, 1);
  assert.equal(state.phone, '+7 777 000 00 00');
});

test('пустое хранилище не оставляет интерфейс в загрузке', async () => {
  const state = await loadCart(empty, 'empty');

  assert.equal(state.hydrated, true);
  assert.equal(state.items.length, 0);
});

test('битые данные не оставляют интерфейс в загрузке', async () => {
  const state = await loadCart(
    { getItem: () => '{это не json', setItem() {}, removeItem() {} },
    'broken'
  );

  assert.equal(state.hydrated, true);
  assert.equal(state.items.length, 0);
});

test('недоступное хранилище не оставляет интерфейс в загрузке', async () => {
  // Приватное окно браузера: обращение к localStorage бросает исключение.
  const state = await loadCart(
    {
      getItem: () => {
        throw new Error('доступ к хранилищу запрещён');
      },
      setItem() {},
      removeItem() {},
    },
    'throws'
  );

  assert.equal(state.hydrated, true);
  assert.equal(state.items.length, 0);
});

test('количество ограничено остатком склада', async () => {
  globalThis.window = { localStorage: empty };
  const { useCart, countItems, cartTotal } = await import('../lib/cart.ts?qty');

  const part = {
    id: 5,
    title: 'Задний тормозной барабан',
    article: '4693501070',
    articleKind: 'number',
    fitment: 'УАЗ',
    brands: ['УАЗ'],
    category: 'Тормоза',
    price: 20_000,
    qty: 3,
  };

  useCart.getState().setQty(part, 10);
  assert.equal(useCart.getState().items[0].qty, 3, 'выше остатка подняться нельзя');

  assert.equal(countItems(useCart.getState().items), 3);
  assert.equal(cartTotal(useCart.getState().items), 60_000);

  // Ноль убирает строку: отдельной кнопки «удалить» у степпера нет.
  useCart.getState().setQty(part, 0);
  assert.equal(useCart.getState().items.length, 0);
});

// --- Стор корзины для карточки и комментарий (решение 18.1) ----------------
// Здесь проверяется только стор: setQty с предложенной ценой. Саму страницу
// /product/:id эти тесты не открывают — это делает tests/e2e/product-offer.e2e.mjs.

const DRUM = {
  id: 5,
  title: 'Задний тормозной барабан',
  article: '4693501070',
  articleKind: 'number',
  fitment: 'УАЗ',
  brands: ['УАЗ'],
  category: 'Тормоза',
  price: 20_000,
  qty: 3,
};

test('стор: setQty с предложенной ценой сохраняет её в позиции', async () => {
  globalThis.window = { localStorage: empty };
  const { useCart, cartTotal, effectiveCartTotal } = await import('../lib/cart.ts?card');

  // Так вызывает стор карточка: добавление сразу с предложенной ценой.
  useCart.getState().setQty(DRUM, 2, 15_000);
  const item = useCart.getState().items[0];
  assert.equal(item.offeredPrice, 15_000);
  assert.equal(item.price, 20_000, 'прайс сохраняется рядом');
  assert.equal(cartTotal(useCart.getState().items), 40_000);
  assert.equal(effectiveCartTotal(useCart.getState().items, null), 30_000);

  // Изменение количества без третьего аргумента торг не сбрасывает.
  useCart.getState().setQty(DRUM, 3);
  assert.equal(useCart.getState().items[0].offeredPrice, 15_000);
  assert.equal(effectiveCartTotal(useCart.getState().items, null), 45_000);

  // Явный null снимает предложение, мусор — тоже.
  useCart.getState().setQty(DRUM, 3, null);
  assert.equal(useCart.getState().items[0].offeredPrice, null);
  useCart.getState().setQty(DRUM, 3, -10);
  assert.equal(useCart.getState().items[0].offeredPrice, null);
});

test('стор: цена через setQty и через setOfferedPrice считается одинаково', async () => {
  globalThis.window = { localStorage: empty };
  const { useCart, effectiveCartTotal } = await import('../lib/cart.ts?same');

  useCart.getState().setQty(DRUM, 2, 15_000);
  const fromCard = effectiveCartTotal(useCart.getState().items, null);
  useCart.getState().clear();

  // Корзина: добавили по прайсу, цену предложили в строке.
  useCart.getState().setQty(DRUM, 2);
  useCart.getState().setOfferedPrice(DRUM.id, 15_000);
  assert.equal(effectiveCartTotal(useCart.getState().items, null), fromCard);

  // Сумма за весь заказ побеждает, откуда бы ни пришло построчное предложение.
  assert.equal(effectiveCartTotal(useCart.getState().items, 25_000), 25_000);
});

test('комментарий ограничен по длине и сбрасывается вместе с корзиной', async () => {
  globalThis.window = { localStorage: empty };
  const { useCart, COMMENT_MAX } = await import('../lib/cart.ts?comment');

  useCart.getState().setComment('я'.repeat(COMMENT_MAX + 20));
  assert.equal(useCart.getState().comment.length, COMMENT_MAX);

  useCart.getState().setQty(DRUM, 1);
  useCart.getState().clear();
  assert.equal(useCart.getState().comment, '');
});
