# ШКВОРЕНЬ — Design Handoff

Source of truth for product rules: `decisions.md` (uploaded) — Google Sheets as single data
source, no B2B tiers, order row written on WhatsApp click, no online payment, no fiscal
documents. This handoff describes the UI built on top of those rules. Two design files:

- `Shkvoren Catalog.dc.html` — customer storefront (catalog, product, cart/checkout, order
  confirmed, print blank).
- `Shkvoren Admin.dc.html` — admin (login, products, product edit, orders, order detail,
  Google Sheets sync).

Both are self-contained interactive prototypes; components below describe intended production
structure, not the prototype's internal code.

## 1. Screen inventory

| Screen | Route (suggested) | Purpose | Desktop | Mobile |
|---|---|---|---|---|
| Каталог | `/` | Browse/filter stock, add to order | Dense list, 6-col grid rows, sticky filter bar | Stacked 2-col rows, category col hidden, sticky cart bar at bottom |
| Результаты поиска | `/?q=` (same screen, search state) | Same list filtered by query | — | — |
| Карточка товара | `/product/:id` | Full detail, cross-numbers, add to order | 2-col (photo + detail) | Stacked, photo on top |
| Корзина / оформление | `/cart` | Adjust qty, contact info, submit | 2-col (lines + sticky summary) | Stacked, summary below lines |
| Заказ создан | `/order/:number/done` | Confirm + hand off to WhatsApp | Centered card, max 520px | Same, full width |
| Печатный бланк | `/order/:number/print` | A4 print document | Fixed A4 canvas (210mm) | Not optimized for mobile — desktop/print only |
| Admin: вход | `/admin/login` | Password gate | Centered card | Same |
| Admin: товары | `/admin/products` | Dense table, all stock | Table, no mobile variant (operator tool) | — |
| Admin: карточка товара | `/admin/products/:id` | Edit one product | 2-col form | — |
| Admin: заказы | `/admin/orders` | List + statuses | Table | — |
| Admin: заказ | `/admin/orders/:number` | Edit composition, status | Line-item table + status select | — |
| Admin: синхронизация | `/admin/sync` | Trigger Sheets sync | Single card | — |

Admin is desktop-only by design (single operator, data-entry tool) — no mobile layout was
built for it.

## 2. Component inventory

**Header** — graphite bar, logo mark + wordmark (Unbounded 800), cart button with count badge.
Variant: `data-no-print` hides it on the print screen.

**Search** — icon + text input, inline clear (×). No debounce needed at this catalog size;
filters client-side on every keystroke.

**Filter — Brand segmented** (Все/ГАЗ/УАЗ) — 3-way toggle, active state fills with brand color
(graphite/GAZ blue/UAZ khaki). **Filter — Category chips** — pill row, horizontal scroll on
overflow, active = filled graphite. **Filter — Only-in-stock toggle** — switch with yellow knob
when on.

**ProductRow** (dense list item) — grid: name+article+fitment | category | price | stock badge
| qty stepper | add button. Click anywhere except stepper/add opens product detail
(`stopPropagation` on those two controls). States: default, hover (bg tint), stock=0 (add
button and stepper disabled, greyed), already-in-cart (add button turns green "В заказе ✓").

**ProductCard** (detail page composition, not a separate reusable widget) — photo slot,
brand+category badges, name, article chip + copy button, fitment box, price + optional market
price, stock badge, qty stepper, add button, "Уточнить, подойдёт ли" link, cross-number chips
(shown only here, per spec).

**Price** — bold, `toLocaleString('ru-RU')` + ₸ suffix. Market price (when known) renders
smaller/muted next to it, prefixed "рынок ≈". Never shown: cost/purchase price (public
components never receive that field).

**Stock badge** — 3 states: green (>5, shows exact count), amber (1–5, exact count), grey
("нет в наличии", count hidden — 0 shown as unavailable, not "0 шт").

**QuantityControl (stepper)** — minus/number/plus, 3-button group, bordered. Disabled minus at
qty 0/1 boundary, disabled plus at stock ceiling.

**Cart / OrderSummary** — line list (name+article, stepper, unit price, line total, remove) +
sticky summary panel (count, total, name*, phone*, comment, print button, WhatsApp submit).
Validation: name/phone required, inline red border + helper text on submit attempt.

**Toast** — bottom-center, dark pill, auto-dismiss ~2s. Used for: added to cart, article
copied, validation error, site-question sent.

**EmptyState** — icon + heading + helper line + action button. Used for: no search results,
empty cart.

**AdminTable** — dense rows, sticky header, hover row tint, click row to open detail. Never
renders `costPrice`/`закупочная` in the public/customer build — only in `Shkvoren
Admin.dc.html`.

**StatusBadge (order)** — color-coded per status: Новый = yellow-tinted, mid-pipeline
(Оплачен…Выдан) = amber, Завершён = green, Отменён = red, else neutral grey.

**PhotoUploader** — dashed drop box placeholder, square aspect in admin product edit, 4:3 in
storefront product photo slot. No actual upload wired in the prototype.

**Modal** — used once, for the order-confirmed screen (rendered inline as a card, not an
overlay, since it's a full navigation destination, not an interrupt).

## 3. Tokens

No `tokens.json`/`design-system.json` file existed in the project at build time — the palette
below was authored from the brief's rules (graphite/signal-yellow/khaki/blue, warm light-gray
ground, border-first surfaces) and is the values actually used in both `.dc.html` files. If a
real `tokens.json` exists in the app repo, reconcile these hex values against it before coding.

**Color**
- Graphite (header/footer/admin sidebar): `#23262B`
- Signal yellow (primary CTA, active toggle): `#F5C400`, hover `#E0B300`
- Ink (default text): `#1C1C1C`
- Muted text: `#6B6B66`
- Warm light-gray ground: `#F3F1EC`
- White surface: `#FFFFFF`
- Border: `#DCD8D0` (light divider `#EEEBE4`)
- UAZ khaki (brand badge only): `#7C7A4E`
- GAZ blue (brand badge only): `#35588F`
- Stock/success green: text `#3F7D46` on `#E7F3E8`
- Stock/warning amber: text `#9A6A00` on `#FBF0D8`
- Out-of-stock/neutral: text `#8A8A8A` on `#EEEEEE`
- Error/danger: text `#B3261E` on `#FBE9E7`

**Typography**
- UI: Onest (400/500/600/700)
- Logo & large headers: Unbounded (700/800)
- Article numbers, order numbers, sync metadata: JetBrains Mono (400/500/600)

**Spacing / radius / borders** — 4/8px spacing rhythm (6/8/12/14/16/20/24px steps used
throughout), radius 6–10px on cards and inputs, 20px pill radius on category chips, 1px
borders everywhere (no shadows except the 1px print-page shadow, which is a screen-only affordance).

**Breakpoints** — mobile <720px (own container width, not window width — see §6), desktop/
tablet share one layout above that threshold. Admin has no breakpoint (desktop-only).

## 4. Interaction contract

- **Add to order** (row/detail button): click → qty set to max(current,1), toast "Добавлено в
  заказ", button becomes green "В заказе ✓". Disabled + 50% opacity when stock = 0.
- **Stepper +/−**: click → clamps to `[0, stock]`; hitting 0 removes the line from cart.
- **Search input**: types → list filters immediately, no loading state needed (in-memory data).
- **Category chip / brand toggle / only-in-stock switch**: click → filters immediately, active
  state restyles the control.
- **Copy article**: click → `navigator.clipboard.writeText`, toast "Артикул скопирован".
  Button hidden entirely when article is null.
- **Уточнить, подойдёт ли**: opens WhatsApp (wa.me) with a prefilled fitment question; includes
  the phone line only if phone was already entered elsewhere in the session.
- **Оформить и отправить в WhatsApp** (cart submit): validates name + phone (both required) →
  on failure, red border + inline helper text under each empty field + toast; on success,
  writes an order record (номер `ШКВ-000N`), navigates to "Заказ создан", and opens WhatsApp
  with the order text template from `decisions.md` §12.
- **Печать бланка**: navigates to the print screen, `window.print()` fires after a short delay
  so the layout settles first.
- **Admin login**: password submit → wrong/short password shows inline error, no lockout in
  MVP (single operator, env-var password per `decisions.md` §6).
- **Admin product save**: click Сохранить → writes to product list, shows "Сохранено ✓" inline
  confirmation next to the button (no toast, since the button doesn't move).
- **Admin archive toggle**: flips status Активен ↔ Архив, no confirmation dialog.
- **Admin order line edit**: qty/price inputs write straight to state; a line whose qty or
  price differs from the original client-submitted values gets a highlighted row + "изменено"
  tag — this is the visual diff the spec asked for between original order and manager edits.
- **Admin sync**: click → button shows spinner + "Синхронизация…" (disabled during run) →
  after completion shows a colored result banner (success green / error red) and updates "last
  sync" timestamp.

## 5. Data contract

**Public (`ProductRow` / `ProductCard`, storefront)** — fields ever sent to the browser:
```
id, name, article (string | null), fitment, category, price, market_price (number | null),
stock (integer), photos (array, possibly empty)
```
`purchase_price` / `закупочная` is **never** included in any payload the storefront reads —
enforce server-side, and per `decisions.md` §5, cover with a test asserting the public endpoint
never returns a cost-price field.

**Admin-only additions**: `cost_price`, `status` (Активен/Архив), internal `id` is the Google
Sheet's own sequential ID column (not a generated SKU, per `decisions.md` §9).

**Order record** (written to the Sheets "Заказы" tab on WhatsApp click, per `decisions.md`
§2): `order_number, items[], total, customer_name, customer_phone, comment, status, created_at`.
Admin's order-detail edits (qty/price per line, added/removed lines) are tracked against the
originally-submitted values so the UI can flag "изменено" lines — persist both the original
and current values, or keep an edit log, so that diff survives a reload.

## 6. Responsive contract

- **Catalog row**: desktop = 6-column grid (name/article/fitment · category · price · stock ·
  stepper · add). Mobile (<720px container width) = 2-column grid, category column hidden
  entirely, price/stock/stepper/add reflow into a compact stacked block per row.
- **Product detail**: desktop = fixed 380px photo column + flexible detail column, side by
  side. Mobile = single column, photo on top.
- **Cart**: desktop = flexible line-item list + a 340px sticky summary sidebar. Mobile = lines
  stacked full-width, summary panel becomes a full-width block below them (not sticky, to avoid
  fighting the on-screen keyboard).
- **Sticky elements**: catalog filter bar (`position: sticky; top: 0`) on both breakpoints;
  bottom cart bar (`position: sticky; bottom: 0`) appears only when cart is non-empty, both
  breakpoints. Cart summary sidebar is sticky only on desktop.
- **Implementation note**: breakpoint state must be measured from the component's own
  rendered width (`ResizeObserver` on the root element), not `window.innerWidth` — the
  storefront may be embedded in a container narrower than the viewport.

## 7. Accessibility

- All icon-only buttons (remove line, close search, back arrow) need an `aria-label` in
  production — the prototype relies on visible adjacent text or an SVG-only affordance that a
  developer should turn into a labelled `<button>`.
- Form fields (name, phone, comment) need associated `<label for>` — the prototype pairs them
  visually only; wire up `id`/`htmlFor` when converting to real markup.
- Contrast: all text/background pairs above meet 4.5:1 (ink `#1C1C1C` on white/`#F3F1EC`/badge
  tints; white on graphite `#23262B`; ink on yellow `#F5C400` for the primary CTA).
- Keyboard: steppers, filter buttons and table rows should be reachable via Tab and operable
  with Enter/Space — the prototype uses native `<button>`/`<input>`/`<select>` throughout
  specifically so this comes for free; don't replace them with `<div onClick>`.
- Disabled controls (stepper at stock ceiling, add-to-order at stock 0, sync button while
  running) use the native `disabled` attribute, not just a visual style, so assistive tech
  announces the state.
- Form errors are announced visually (red border + helper text) next to the field; production
  should also set `aria-invalid` + `aria-describedby` pointing at the helper text.

## 8. Implementation notes

- **Reusable across screens**: Header, Search, Filter (brand/category/stock-toggle),
  ProductRow, QuantityControl, Price, StockBadge, Toast, EmptyState, AdminTable row, StatusBadge.
- **Page-specific composition**: ProductCard detail layout, Cart/OrderSummary layout, Order
  Confirmed card, Print blank layout, Admin product-edit form, Admin order-detail table — these
  arrange reusable primitives but aren't themselves reused elsewhere.
- **Client-side only in the prototype**: all filtering, cart state, and admin edits are
  in-memory. In production, catalog list and stock/price should be **server-rendered or
  server-fetched with a 3–5 min cache** (per `decisions.md` §1 — Sheets API from the server,
  never the browser), with a manual "Обновить сейчас" refresh in admin. Cart contents can stay
  client-side (localStorage) until checkout.
- **Server-side required**: writing the order row to the Sheets "Заказы" tab, generating the
  next `ШКВ-000N` number (next free row, not a client-side counter — the prototype's counter is
  a stand-in), and guaranteeing `cost_price` never serializes to the public API.
- **Needs real state/persistence beyond the prototype**: admin auth session (cookie, per
  `decisions.md` §6), the Sheets sync job and its last-run/last-error status, and the
  original-vs-edited order line tracking used for the "изменено" tags.
- **Not built into MVP by design** (confirm before adding): payment, delivery-method choice at
  checkout, retail/B2B pricing tiers, automatic stock decrement on order — all explicitly
  excluded by `decisions.md`.
