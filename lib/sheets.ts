/**
 * Доступ к Google Sheets — единственное место в проекте, которое знает
 * о ключе сервисного аккаунта (docs/technical-spec.md §4).
 *
 * Зависимостей нет намеренно: пакет googleapis весит десятки мегабайт ради
 * двух вызовов REST API. JWT подписывается через node:crypto, запросы идут
 * обычным fetch.
 *
 * Модуль серверный. Попадание его в клиентский бандл означает утечку ключа,
 * поэтому файл помечен 'server-only'.
 */
import 'server-only';
import { createSign } from 'node:crypto';

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const SHEETS_API = 'https://sheets.googleapis.com/v4/spreadsheets';
const SCOPE = 'https://www.googleapis.com/auth/spreadsheets';

/** Ошибка обращения к таблице. Отличается от ошибок разбора данных. */
export class SheetsError extends Error {
  /** Исходный ответ Google — для журнала, не для показа покупателю. */
  readonly detail: string | undefined;

  // Поле объявлено явно, а не параметром конструктора: Node исполняет
  // модули lib/ в тестах через стирание типов, а parameter property
  // в этом режиме не поддерживается.
  constructor(message: string, detail?: string) {
    super(message);
    this.name = 'SheetsError';
    this.detail = detail;
  }
}

/** Обязательная переменная окружения. Пустая — это отказ, а не значение по умолчанию. */
function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === '') {
    throw new SheetsError(
      `Не задана переменная окружения ${name}. Заполните .env.local по образцу .env.example.`
    );
  }
  return value;
}

/** Имя листа каталога. Значение по умолчанию совпадает с реальной таблицей. */
export function partsSheetName(): string {
  return process.env.SHEET_PARTS_NAME?.trim() || 'Запчасти';
}

/** Имя листа заказов. */
export function ordersSheetName(): string {
  return process.env.SHEET_ORDERS_NAME?.trim() || 'Заказы';
}

/** base64url без выравнивающих знаков — требование формата JWT. */
function base64url(input: string | Buffer): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/** Кэш токена в памяти процесса: он живёт час, просить новый на каждый запрос незачем. */
let cachedToken: { value: string; expiresAt: number } | null = null;

/**
 * Получить access token сервисного аккаунта.
 * Подписывается RS256-JWT и обменивается на токен по OAuth 2.0.
 */
async function getAccessToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);

  // Обновляем за минуту до истечения, чтобы запрос не попал в момент смены.
  if (cachedToken && cachedToken.expiresAt > now + 60) return cachedToken.value;

  const email = requireEnv('GOOGLE_SERVICE_ACCOUNT_EMAIL');
  // В переменных окружения переводы строк хранятся экранированными.
  const key = requireEnv('GOOGLE_PRIVATE_KEY').replace(/\\n/g, '\n');

  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = base64url(
    JSON.stringify({
      iss: email,
      scope: SCOPE,
      aud: TOKEN_URL,
      iat: now,
      exp: now + 3600,
    })
  );

  const signer = createSign('RSA-SHA256');
  signer.update(`${header}.${claims}`);
  let signature: string;
  try {
    signature = base64url(signer.sign(key));
  } catch {
    throw new SheetsError(
      'Не удалось подписать запрос ключом сервисного аккаунта. Проверьте GOOGLE_PRIVATE_KEY.'
    );
  }

  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${header}.${claims}.${signature}`,
    }),
  });

  if (!response.ok) {
    throw new SheetsError(
      'Google не выдал доступ сервисному аккаунту.',
      await response.text()
    );
  }

  const data = (await response.json()) as { access_token?: string; expires_in?: number };
  if (!data.access_token) {
    throw new SheetsError('Ответ Google не содержит access_token.');
  }

  cachedToken = {
    value: data.access_token,
    expiresAt: now + (data.expires_in ?? 3600),
  };
  return cachedToken.value;
}

/** Запрос к Sheets API с подставленным токеном. */
async function call(path: string, init?: RequestInit): Promise<Response> {
  const token = await getAccessToken();
  const sheetId = requireEnv('SHEET_ID');

  return fetch(`${SHEETS_API}/${encodeURIComponent(sheetId)}${path}`, {
    ...init,
    headers: {
      ...init?.headers,
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    // Кэширование делает вызывающий код (unstable_cache), здесь оно мешает.
    cache: 'no-store',
  });
}

/**
 * Прочитать диапазон листа.
 *
 * Возвращает строки так, как их отдаёт Google: короткие строки не дополняются
 * до одинаковой длины, пустые хвостовые ячейки опускаются. Разбор обязан
 * это учитывать — так и сделано в lib/parts.ts.
 *
 * @param range например «Запчасти!A1:AI1000»
 */
export async function getValues(range: string): Promise<string[][]> {
  const response = await call(
    `/values/${encodeURIComponent(range)}?valueRenderOption=UNFORMATTED_VALUE`
  );

  if (!response.ok) {
    throw new SheetsError(
      `Не удалось прочитать диапазон «${range}».`,
      await response.text()
    );
  }

  const data = (await response.json()) as { values?: unknown[][] };
  // UNFORMATTED_VALUE возвращает числа числами — приводим всё к строкам,
  // чтобы разбор работал одинаково и с таблицей, и со снимком .xlsx.
  return (data.values ?? []).map((row) =>
    row.map((cell) => (cell === null || cell === undefined ? '' : String(cell)))
  );
}

/**
 * Дописать строку в конец листа.
 *
 * Используется только для листа «Заказы». Существующие строки никогда
 * не изменяются и не удаляются (решение 2).
 *
 * @returns номер строки, в которую попала запись
 */
export async function appendRow(sheet: string, row: string[]): Promise<number> {
  const range = `${sheet}!A:H`;
  // RAW, а не USER_ENTERED: телефон, начинающийся с плюса, Google принимал
  // за формулу и записывал в лист «#ERROR!» вместо контакта покупателя.
  // Заказ — это данные, вычислять в нём нечего.
  const response = await call(
    `/values/${encodeURIComponent(range)}:append` +
      `?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
    { method: 'POST', body: JSON.stringify({ values: [row] }) }
  );

  if (!response.ok) {
    throw new SheetsError(
      `Не удалось записать строку в лист «${sheet}».`,
      await response.text()
    );
  }

  const data = (await response.json()) as { updates?: { updatedRange?: string } };
  // Google возвращает диапазон вида «Заказы!A12:H12» — вынимаем номер строки.
  const rowNumber = Number(/!\D+(\d+)/.exec(data.updates?.updatedRange ?? '')?.[1]);
  if (!Number.isFinite(rowNumber)) {
    throw new SheetsError('Google не сообщил, в какую строку записан заказ.');
  }
  return rowNumber;
}

/**
 * Сколько строк занято в листе. Нужно для номера заказа: он вычисляется
 * из фактического состояния листа, а не из счётчика в приложении
 * (docs/data-model.md §8).
 */
export async function countRows(sheet: string): Promise<number> {
  const values = await getValues(`${sheet}!A:A`);
  return values.length;
}
