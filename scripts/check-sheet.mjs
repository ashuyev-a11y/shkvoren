/**
 * Диагностика реальной Google-таблицы — docs/technical-spec.md §11.
 *
 * Запускается вручную перед деплоем и после правок таблицы оператором:
 *   node --env-file=.env.local scripts/check-sheet.mjs
 *
 * Печатает контрольные суммы, список проблем и раскладку по маркам
 * и категориям. Ничего не изменяет в таблице.
 */
import { parseSheet, EXPECTED } from '../lib/parts.ts';
import { formatPrice } from '../lib/format.ts';

/**
 * Обращение к Sheets API повторяет lib/sheets.ts, но без 'server-only':
 * этот скрипт исполняется в обычном Node, а не в Next.js.
 */
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const SHEETS_API = 'https://sheets.googleapis.com/v4/spreadsheets';

function requireEnv(name) {
  const value = process.env[name];
  if (!value || value.trim() === '') {
    console.error(`Не задана переменная ${name}. Запустите с --env-file=.env.local`);
    process.exit(2);
  }
  return value;
}

function base64url(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

async function getAccessToken() {
  const { createSign } = await import('node:crypto');
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = base64url(
    JSON.stringify({
      iss: requireEnv('GOOGLE_SERVICE_ACCOUNT_EMAIL'),
      scope: 'https://www.googleapis.com/auth/spreadsheets',
      aud: TOKEN_URL,
      iat: now,
      exp: now + 3600,
    })
  );

  const signer = createSign('RSA-SHA256');
  signer.update(`${header}.${claims}`);
  const signature = base64url(signer.sign(requireEnv('GOOGLE_PRIVATE_KEY').replace(/\\n/g, '\n')));

  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${header}.${claims}.${signature}`,
    }),
  });

  if (!response.ok) {
    console.error('Google не выдал доступ:', await response.text());
    process.exit(3);
  }
  return (await response.json()).access_token;
}

const sheetName = process.env.SHEET_PARTS_NAME?.trim() || 'Запчасти';
const range = `${sheetName}!A1:AI2000`;
const token = await getAccessToken();

const response = await fetch(
  `${SHEETS_API}/${encodeURIComponent(requireEnv('SHEET_ID'))}` +
    `/values/${encodeURIComponent(range)}?valueRenderOption=UNFORMATTED_VALUE`,
  { headers: { authorization: `Bearer ${token}` } }
);

if (!response.ok) {
  console.error(`Не удалось прочитать «${range}»:`, await response.text());
  process.exit(4);
}

const rows = ((await response.json()).values ?? []).map((row) =>
  row.map((cell) => (cell === null || cell === undefined ? '' : String(cell)))
);

const { parts, issues } = parseSheet(rows, new Date().toISOString());

const units = parts.reduce((sum, part) => sum + part.qty, 0);
const total = parts.reduce((sum, part) => sum + part.qty * part.price, 0);

console.log(`\nЛист «${sheetName}», строк получено: ${rows.length}\n`);
console.log('Контрольные суммы');
console.log(`  позиций на витрине   ${parts.length}   (в снимке было ${EXPECTED.parts} до фильтра марок)`);
console.log(`  единиц на складе     ${units}   (в снимке ${EXPECTED.units})`);
console.log(`  стоимость склада     ${formatPrice(total)}   (в снимке ${formatPrice(EXPECTED.total)})`);

const byBrand = { ГАЗ: 0, УАЗ: 0, 'без марки': 0 };
for (const part of parts) {
  if (part.brands.length === 0) byBrand['без марки'] += 1;
  for (const brand of part.brands) byBrand[brand] += 1;
}
console.log('\nПо маркам (позиция с «УАЗ/ГАЗ» считается в обеих)');
for (const [brand, count] of Object.entries(byBrand)) {
  console.log(`  ${brand.padEnd(20)} ${count}`);
}

const byCategory = new Map();
for (const part of parts) {
  byCategory.set(part.category, (byCategory.get(part.category) ?? 0) + 1);
}
console.log('\nПо категориям');
for (const [name, count] of [...byCategory].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${name.padEnd(20)} ${count}`);
}

const noArticle = parts.filter((part) => part.article === null).length;
const sizes = parts.filter((part) => part.articleKind === 'size').length;
console.log('\nАртикулы');
console.log(`  без артикула         ${noArticle}`);
console.log(`  размеры, не номера   ${sizes}`);

const errors = issues.filter((issue) => issue.level === 'error');
const warnings = issues.filter((issue) => issue.level === 'warning');

console.log(`\nОшибки строк: ${errors.length}, предупреждения: ${warnings.length}`);
for (const issue of [...errors, ...warnings]) {
  const where = issue.row === 0 ? 'лист' : `строка ${issue.row}`;
  console.log(`  [${issue.level}] ${where}: ${issue.reason}`);
}

// Ошибка строки означает, что позиция не попадёт на витрину. Это повод
// остановить деплой и поправить таблицу, а не принять как норму.
process.exit(errors.length > 0 ? 1 : 0);
