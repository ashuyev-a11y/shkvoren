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
