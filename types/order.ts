/**
 * Типы заказа — контракт из docs/data-model.md §8 и docs/technical-spec.md §6.
 *
 * Заказ существует с момента записи строки в лист «Заказы» (решение 2).
 * Всё, что до записи, — черновик в браузере.
 */

/** Позиция корзины в том виде, в котором её присылает браузер. */
export type OrderDraftItem = {
  /** Ключ позиции — колонка ID таблицы. */
  id: number;
  /** Количество, целое, не больше остатка. */
  qty: number;
};

/**
 * Тело запроса POST /api/orders.
 *
 * Цены в запросе нет намеренно: сервер берёт её по id из таблицы,
 * клиентское значение игнорируется (technical-spec.md §6).
 */
export type OrderDraft = {
  /** Телефон покупателя. Обязателен: без него в логе заказа нет контакта (решение 2). */
  phone: string;
  items: OrderDraftItem[];
};

/** Позиция подтверждённого заказа с ценой, зафиксированной сервером. */
export type OrderLine = {
  id: number;
  title: string;
  article: string | null;
  qty: number;
  /** Цена за штуку на момент заказа, целые тенге. */
  price: number;
  /** price × qty. */
  sum: number;
};

/** Ответ POST /api/orders после успешной записи в лист «Заказы». */
export type OrderResult = {
  /** Номер вида ШКВ-0001 (решение 4). */
  orderNo: string;
  total: number;
  /** Готовая ссылка в WhatsApp с текстом по решению 12. Собирается в lib/whatsapp.ts. */
  whatsappUrl: string;
};

/** Заказ целиком — для бланка печати и админки. */
export type Order = {
  orderNo: string;
  /** ISO 8601 с часовым поясом Уральска. */
  createdAt: string;
  phone: string;
  lines: OrderLine[];
  total: number;
  /** При создании всегда «новый» (data-model.md §8). */
  status: string;
};
