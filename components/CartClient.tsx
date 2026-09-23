/**
 * Корзина и оформление — хэндоф §1, §2, §6.
 *
 * Телефон обязателен (решение 2): без него в листе «Заказы» не остаётся
 * контакта для связи. Ошибка валидации показывается подписью под полем
 * и не исчезает сама — тост для этого не годится.
 *
 * Порядок при отправке: POST /api/orders записывает строку в лист, и только
 * после успешного ответа покупатель уходит в WhatsApp. Ссылку собирает
 * сервер (lib/whatsapp.ts), здесь она не строится.
 */
'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  COMMENT_MAX,
  cartTotal,
  countItems,
  effectiveCartTotal,
  itemPrice,
  useCart,
} from '../lib/cart';
import { formatPrice, isValidPhone } from '../lib/format';
import { EmptyState } from './EmptyState';
import { OfferPrice } from './OfferPrice';
import { Price } from './Price';
import { QuantityControl } from './QuantityControl';

export function CartClient() {
  const router = useRouter();

  const items = useCart((s) => s.items);
  const hydrated = useCart((s) => s.hydrated);
  const phone = useCart((s) => s.phone);
  const setPhone = useCart((s) => s.setPhone);
  const remove = useCart((s) => s.remove);
  const clear = useCart((s) => s.clear);
  const offeredTotal = useCart((s) => s.offeredTotal);
  const setOfferedTotal = useCart((s) => s.setOfferedTotal);
  const setOfferedPrice = useCart((s) => s.setOfferedPrice);
  const comment = useCart((s) => s.comment);
  const setComment = useCart((s) => s.setComment);

  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  // До чтения localStorage содержимое неизвестно: рисовать «корзина пуста»
  // в этот момент — значит показать неправду тем, у кого заказ есть.
  if (!hydrated) {
    return <p className="t-body text-ink-muted">Загружаем заказ…</p>;
  }

  if (items.length === 0) {
    return (
      <EmptyState
        title="В заказе пока пусто"
        hint="Выберите позиции в каталоге — количество можно будет изменить здесь."
        action={
          <Link
            href="/"
            className="t-body-strong bg-signal text-on-signal inline-flex items-center rounded-md px-6 py-3"
          >
            Открыть каталог
          </Link>
        }
      />
    );
  }

  // Две суммы: по прайсу и та, которую покупатель предлагает заплатить
  // (решение 18). Совпадают — торга нет, показываем одно «Итого».
  const listSum = cartTotal(items);
  const total = effectiveCartTotal(items, offeredTotal);
  const bargaining = total !== listSum;
  const count = countItems(items);

  /** Изменить количество, не обращаясь к каталогу: потолок хранится в строке. */
  function changeQty(id: number, next: number) {
    const item = items.find((i) => i.id === id);
    if (item === undefined) return;

    useCart.getState().setQty(
      {
        id: item.id,
        title: item.title,
        article: item.article,
        articleKind: item.articleKind,
        fitment: null,
        brands: [],
        category: '',
        price: item.price,
        qty: item.stock,
      },
      next
    );
  }

  async function submit() {
    setFormError(null);

    if (!isValidPhone(phone)) {
      setPhoneError('Укажите телефон — без него мы не сможем с вами связаться.');
      return;
    }
    setPhoneError(null);
    setSending(true);

    try {
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone,
          // Прайсовые цены не отправляем: сервер берёт их из таблицы по id.
          // Предложенные — отправляем, их неоткуда взять, кроме покупателя.
          items: items.map((item) => ({
            id: item.id,
            qty: item.qty,
            offeredPrice: item.offeredPrice,
          })),
          offeredTotal,
          // Комментарий необязателен (решение 18.1): пустой сервер не сохранит.
          comment,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setFormError(data.error ?? 'Не удалось оформить заказ.');
        return;
      }

      // Заказ записан в лист — только теперь чистим корзину и уходим.
      clear();

      // Ссылка открывается до перехода: на странице подтверждения она
      // уже не будет доступна, сервер отдал её один раз.
      window.open(data.whatsappUrl, '_blank', 'noopener');
      router.push(`/order/done?no=${encodeURIComponent(data.orderNo)}`);
    } catch {
      setFormError('Связь прервалась. Проверьте интернет и попробуйте ещё раз.');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex flex-col gap-6 md:flex-row md:items-start">
      {/* Позиции */}
      <ul className="border-line min-w-0 flex-1 list-none rounded-md border p-0">
        {items.map((item) => (
          <li
            key={item.id}
            className="border-line bg-surface-raised border-b px-4 py-3 last:border-b-0"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <Link href={`/product/${item.id}`} className="t-body-strong">
                  {item.title}
                </Link>
                {item.article !== null && (
                  <p className="t-part-number part-number text-ink-muted mt-1 mb-0">
                    {item.article}
                  </p>
                )}
              </div>

              <button
                type="button"
                onClick={() => remove(item.id)}
                aria-label={`Убрать из заказа: ${item.title}`}
                className="text-ink-muted hover:text-danger min-h-0 p-2"
              >
                ×
              </button>
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <QuantityControl
                value={item.qty}
                max={item.stock}
                onChange={(next) => changeQty(item.id, next)}
                title={item.title}
              />

              <span className="t-small text-ink-muted">
                {item.offeredPrice === null ? (
                  `${formatPrice(item.price)} за штуку`
                ) : (
                  // Прайс не прячем: покупатель должен видеть, от чего торгуется.
                  <>
                    <s>{formatPrice(item.price)}</s> {formatPrice(item.offeredPrice)} за
                    штуку
                  </>
                )}
              </span>

              <Price value={itemPrice(item) * item.qty} />
            </div>

            {/* Торг по позиции (решение 18) */}
            <div className="mt-3">
              <OfferPrice
                value={item.offeredPrice}
                onChange={(next) => setOfferedPrice(item.id, next)}
                label={`Ваша цена за шт: ${item.title}`}
                linkLabel="Предложить свою цену"
              />
            </div>
          </li>
        ))}
      </ul>

      {/* Итог и отправка */}
      <aside className="border-line bg-surface-raised w-full rounded-md border px-4 py-4 md:sticky md:top-4 md:w-[340px] md:shrink-0">
        <p className="t-body m-0 flex justify-between">
          <span>Позиций</span>
          <span style={{ fontVariantNumeric: 'tabular-nums' }}>{count} шт</span>
        </p>

        {bargaining && (
          <p className="t-body text-ink-muted mt-2 mb-0 flex items-center justify-between">
            <span>По прайсу</span>
            <span style={{ fontVariantNumeric: 'tabular-nums' }}>
              {formatPrice(listSum)}
            </span>
          </p>
        )}

        <p className="t-body mt-2 mb-0 flex items-center justify-between">
          <span>{bargaining ? 'Ваше предложение' : 'Итого'}</span>
          <Price value={total} large />
        </p>

        {/* Торг за весь заказ (решение 18) */}
        <div className="mt-4">
          <OfferPrice
            value={offeredTotal}
            onChange={setOfferedTotal}
            label="Ваша сумма за весь заказ"
            linkLabel="Предложить свою сумму за весь заказ"
            hint="Сумма за заказ заменяет собой цены по позициям."
          />
        </div>

        <div className="mt-6">
          <label htmlFor="phone" className="t-caption text-ink-muted block">
            Ваш телефон
          </label>
          <input
            id="phone"
            type="tel"
            inputMode="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+7 701 000 00 00"
            aria-invalid={phoneError !== null}
            aria-describedby={phoneError !== null ? 'phone-error' : undefined}
            className={`t-body bg-surface-raised mt-1 w-full rounded-md border px-3 ${
              phoneError !== null ? 'border-danger' : 'border-control-border'
            }`}
          />
          {phoneError !== null && (
            <p id="phone-error" className="t-small text-danger mt-1 mb-0">
              {phoneError}
            </p>
          )}
        </div>

        {/* Комментарий к заказу (решение 18.1): необязателен, без валидации */}
        <div className="mt-4">
          <label htmlFor="order-comment" className="t-caption text-ink-muted block">
            Комментарий к заказу
          </label>
          <textarea
            id="order-comment"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            maxLength={COMMENT_MAX}
            rows={3}
            aria-describedby="order-comment-hint"
            className="t-body bg-surface-raised border-control-border mt-1 w-full rounded-md border px-3 py-2"
          />
          <p id="order-comment-hint" className="t-small text-ink-muted mt-1 mb-0">
            Необязательно. До {COMMENT_MAX} символов, сейчас {comment.length}.
          </p>
        </div>

        <button
          type="button"
          onClick={submit}
          disabled={sending}
          className="t-body-strong bg-whatsapp text-on-whatsapp mt-4 w-full rounded-md px-6 disabled:opacity-60"
        >
          {sending ? 'Отправляем…' : 'Отправить в WhatsApp'}
        </button>

        {formError !== null && (
          <p role="alert" className="t-small text-danger mt-2 mb-0">
            {formError}
          </p>
        )}

        {/*
          Бланк печатается до отправки: номер заказа присваивается листом
          «Заказы» в момент записи, и на распечатке его ещё нет.
        */}
        <Link
          href="/print"
          className="t-body-strong border-control-border mt-3 flex w-full items-center justify-center rounded-md border px-6 py-3"
        >
          Образец бланка
        </Link>

        <p className="t-small text-ink-muted mt-4 mb-0">
          Оплата и выдача — на месте, на Салеме. Заказ ничего не резервирует до
          подтверждения.
          {bargaining && ' Предложенную цену продавец подтверждает в переписке.'}
        </p>
      </aside>
    </div>
  );
}
