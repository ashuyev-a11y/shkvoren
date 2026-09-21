/**
 * Бланк заказа А4 — решение 3, печать браузером через window.print().
 *
 * Это не накладная и не фискальный документ: реквизитов, НДС и подписей
 * в нём нет. Назначение — лист, с которым покупатель подходит к прилавку.
 *
 * Данные берутся из корзины в браузере. Читать заказ из листа по номеру
 * нельзя: номера последовательны, перебором открылся бы чужой заказ
 * вместе с телефоном (разбор хэндофа, пункт A7).
 */
'use client';

import Link from 'next/link';
import { cartTotal, countItems, useCart } from '../lib/cart';
import { formatPrice } from '../lib/format';
import { SELLER_NAME, sellerLines } from '../lib/seller';
import { EmptyState } from './EmptyState';
import { LogoMark } from './LogoMark';

/** Дата печати в виде, привычном на бумаге: 20.09.2026. */
function printDate(): string {
  const now = new Date();
  const day = String(now.getDate()).padStart(2, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${day}.${month}.${now.getFullYear()}`;
}

export function OrderBlank() {
  const items = useCart((s) => s.items);
  const phone = useCart((s) => s.phone);
  const hydrated = useCart((s) => s.hydrated);

  if (!hydrated) {
    return <p className="t-body text-ink-muted">Готовим бланк…</p>;
  }

  if (items.length === 0) {
    return (
      <EmptyState
        title="Печатать нечего"
        hint="Соберите заказ в каталоге — бланк соберётся из выбранных позиций."
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

  const lines = sellerLines();

  return (
    <>
      {/* Кнопки на печать не попадают — класс no-print в globals.css */}
      <div className="no-print mb-6 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => window.print()}
          className="t-body-strong bg-signal text-on-signal rounded-md px-6"
        >
          Печать
        </button>

        <Link
          href="/cart"
          className="t-body-strong border-control-border inline-flex items-center rounded-md border px-6 py-3"
        >
          Вернуться к заказу
        </Link>
      </div>

      <article className="print-sheet border-line bg-surface-raised mx-auto rounded-md border px-8 py-8">
        {/* Летерхед */}
        <header className="border-line flex flex-wrap items-start justify-between gap-4 border-b pb-4">
          <div>
            {/* Логотип по брендбуку: знак слева, зазор space-2 */}
            <p
              className="t-title m-0 flex items-center"
              style={{
                fontFamily: 'var(--font-display)',
                letterSpacing: '-0.01em',
                gap: 'var(--space-2)',
              }}
            >
              <LogoMark />
              {SELLER_NAME}
            </p>
            {lines.map((line) => (
              <p key={line} className="t-small text-ink-muted mt-1 mb-0">
                {line}
              </p>
            ))}
          </div>

          <div className="text-right">
            <p className="t-caption text-ink-muted m-0">Бланк заказа</p>
            <p className="t-body mt-1 mb-0">{printDate()}</p>
          </div>
        </header>

        {/*
          Номер заказа на бланке не печатается: он присваивается листом
          «Заказы» в момент записи (решение 4), а бланк собирается до отправки.
          Печатать сюда «ШКВ-000N» из числа позиций, как в макете, значит
          выдать выдуманный номер за настоящий.
        */}
        <p className="t-body mt-4 mb-0">
          Телефон покупателя: {phone.trim() === '' ? '__________________' : phone}
        </p>

        <table className="mt-6 w-full border-collapse">
          <thead>
            <tr className="border-line border-b">
              <th className="t-caption text-ink-muted px-2 py-2 text-left">Номер</th>
              <th className="t-caption text-ink-muted px-2 py-2 text-left">Наименование</th>
              <th className="t-caption text-ink-muted px-2 py-2 text-right">Кол-во</th>
              <th className="t-caption text-ink-muted px-2 py-2 text-right">Цена</th>
              <th className="t-caption text-ink-muted px-2 py-2 text-right">Сумма</th>
            </tr>
          </thead>

          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-line border-b">
                <td className="t-part-number part-number px-2 py-2 align-top">
                  {/* Размер каталожным номером не выдаём (решение 11) */}
                  {item.article !== null && item.articleKind !== 'none' ? item.article : '—'}
                </td>
                <td className="t-body px-2 py-2 align-top">{item.title}</td>
                <td
                  className="t-body px-2 py-2 text-right align-top"
                  style={{ fontVariantNumeric: 'tabular-nums' }}
                >
                  {item.qty}
                </td>
                <td
                  className="t-body px-2 py-2 text-right align-top"
                  style={{ fontVariantNumeric: 'tabular-nums' }}
                >
                  {formatPrice(item.price)}
                </td>
                <td
                  className="t-body-strong px-2 py-2 text-right align-top"
                  style={{ fontVariantNumeric: 'tabular-nums' }}
                >
                  {formatPrice(item.price * item.qty)}
                </td>
              </tr>
            ))}
          </tbody>

          <tfoot>
            <tr>
              <td colSpan={2} className="t-body px-2 py-3">
                Позиций: {items.length}, всего {countItems(items)} шт
              </td>
              <td colSpan={2} className="t-body-strong px-2 py-3 text-right">
                Итого
              </td>
              <td
                className="t-price px-2 py-3 text-right"
                style={{ fontVariantNumeric: 'tabular-nums' }}
              >
                {formatPrice(cartTotal(items))}
              </td>
            </tr>
          </tfoot>
        </table>

        <p className="t-small text-ink-muted mt-6 mb-0">
          Бланк для сверки на месте. Цены действуют на дату печати, наличие
          подтверждается при выдаче.
        </p>
      </article>
    </>
  );
}
