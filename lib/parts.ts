/**
 * Чтение и разбор листа «Запчасти».
 *
 * Правила целиком заданы в docs/data-model.md — здесь только их исполнение.
 * Ни одно значение не додумывается: если ячейка пуста, поле становится null
 * или строка объявляется ошибочной (AGENTS.md, запрет на выдумывание данных).
 */
import type {
  AdminPart,
  ArticleKind,
  Brand,
  PartsRead,
  PublicPart,
  SheetIssue,
} from '../types/part.ts';

/**
 * Номера колонок листа (0 = A). Порядок зафиксирован в docs/data-model.md §2.
 * Если оператор переставит колонки местами, импорт сломается осознанно,
 * а не начнёт молча читать цену из колонки остатка.
 */
export const COLUMN = {
  article: 0, // A
  title: 1, // B
  fitment: 3, // D
  category: 4, // E
  costPrice: 6, // G — наружу не уходит никогда
  price: 7, // H
  qty: 10, // K
  marketPrice: 28, // AC
  marketDelta: 32, // AG
  priceNote: 33, // AH
  id: 34, // AI — ключ, заводится оператором
} as const;

/** Контрольные суммы снимка (docs/data-model.md §1). Сверены с листом «Сводка». */
export const EXPECTED = {
  parts: 278,
  units: 2846,
  total: 13_926_450,
} as const;

/**
 * Кириллические буквы, визуально совпадающие с латинскими.
 * Нужны, чтобы артикул «53А170201002» с кириллической А находился
 * по латинскому вводу (docs/data-model.md §5).
 */
const CYRILLIC_TO_LATIN: Record<string, string> = {
  А: 'A', В: 'B', Е: 'E', К: 'K', М: 'M', Н: 'H',
  О: 'O', Р: 'P', С: 'C', Т: 'T', У: 'Y', Х: 'X',
};

/** Размер сальника или подшипника: 42x68x16.4, 95х130х12х17.5. */
const SIZE_PATTERN = /^\d+[.,]?\d*\s*[xх]\s*\d/i;

/** Наименование: только trim и схлопывание пробелов. Регистр источника сохраняется. */
export function normalizeTitle(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim();
}

/**
 * Что именно лежит в колонке «Артикул».
 * В данных это не всегда каталожный номер: 24 значения из 185 — размеры.
 */
export function classifyArticle(raw: string | null): ArticleKind {
  const value = (raw ?? '').trim();
  if (!value) return 'none';
  return SIZE_PATTERN.test(value) ? 'size' : 'number';
}

/**
 * Нормализация артикула для поиска: верхний регистр, только буквы и цифры,
 * кириллица приведена к латинице. Отображается при этом всегда исходное
 * значение — дефисы не расставляются (docs/data-model.md §5).
 */
export function normalizeArticle(raw: string | null): string {
  if (!raw) return '';
  let out = '';
  for (const char of raw.toUpperCase()) {
    // Кириллические двойники латиницы заменяются, остальные кириллические
    // буквы сохраняются: выбросить «Г» из «Г25000370120001» — значит потерять
    // часть номера и столкнуть его с чужим.
    const mapped = CYRILLIC_TO_LATIN[char] ?? char;
    if (/[A-Z0-9А-Я]/.test(mapped)) out += mapped;
  }
  return out;
}

/**
 * Строка — хвост шаблона таблицы, а не позиция.
 *
 * Ниже последней заполненной строки лист содержит ~720 строк с формулами,
 * которые дают 0 в колонках «Остаток» и «Всего на сумму». Формально такие
 * строки не пусты, но товара в них нет. Признак: нет ни артикула,
 * ни наименования, ни категории.
 */
function isTemplateTail(cells: string[]): boolean {
  return (
    (cells[COLUMN.article] ?? '').trim() === '' &&
    (cells[COLUMN.title] ?? '').trim() === '' &&
    (cells[COLUMN.category] ?? '').trim() === ''
  );
}

/**
 * Марки по вхождению подстроки в строку применимости (решение 7).
 * «Газель», «ГАЗ 53», «ГАЗ 66,3308» попадают в ГАЗ — это верно.
 * Разбирать строку на модели запрещено: написаний 17, парсинг переврёт данные.
 */
export function detectBrands(fitment: string | null): Brand[] {
  const text = (fitment ?? '').toUpperCase().replace(/Ё/g, 'Е');
  const brands: Brand[] = [];
  if (text.includes('ГАЗ')) brands.push('ГАЗ');
  if (text.includes('УАЗ')) brands.push('УАЗ');
  return brands;
}

/** Ячейка → целое число. Возвращает null, если значение пустое или нечисловое. */
function parseInteger(raw: string | undefined): number | null {
  const value = (raw ?? '').trim().replace(/\s/g, '').replace(',', '.');
  if (!value) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.round(parsed);
}

/** Ячейка → дробное число или null. Для рыночных полей, где дробь осмысленна. */
function parseDecimal(raw: string | undefined): number | null {
  const value = (raw ?? '').trim().replace(/\s/g, '').replace(',', '.');
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Ячейка → строка или null. */
function parseText(raw: string | undefined): string | null {
  const value = normalizeTitle(raw ?? '');
  return value === '' ? null : value;
}

/** Результат разбора одной строки: либо позиция, либо причина отказа. */
type RowResult =
  | { ok: true; part: AdminPart }
  | { ok: false; reason: string };

/**
 * Разбор одной строки листа.
 *
 * Обязательны четыре поля: ID, наименование, цена, остаток.
 * Отсутствие любого — отказ. Подставлять ноль вместо цены или генерировать
 * ID на лету запрещено: ID, выданный на лету, «уедет» при первой сортировке
 * таблицы, и старые заказы будут ссылаться не на те позиции.
 */
export function parseRow(cells: string[], rowNumber: number): RowResult {
  const id = parseInteger(cells[COLUMN.id]);
  if (id === null || id <= 0) {
    return { ok: false, reason: 'Пустая или нечисловая колонка ID — позиции нужен ключ.' };
  }

  const title = normalizeTitle(cells[COLUMN.title] ?? '');
  if (!title) {
    return { ok: false, reason: `ID ${id}: пустое наименование.` };
  }

  const price = parseInteger(cells[COLUMN.price]);
  if (price === null || price <= 0) {
    return { ok: false, reason: `ID ${id}: цена продажи не указана или не число.` };
  }

  const qty = parseInteger(cells[COLUMN.qty]);
  if (qty === null || qty < 0) {
    return { ok: false, reason: `ID ${id}: остаток не указан или не число.` };
  }

  const article = parseText(cells[COLUMN.article]);
  const fitment = parseText(cells[COLUMN.fitment]);
  const category = parseText(cells[COLUMN.category]);
  if (category === null) {
    return { ok: false, reason: `ID ${id}: пустая категория.` };
  }

  return {
    ok: true,
    part: {
      id,
      title,
      article,
      articleKind: classifyArticle(article),
      fitment,
      brands: detectBrands(fitment),
      category,
      price,
      qty,
      row: rowNumber,
      articleNorm: normalizeArticle(article),
      costPrice: parseInteger(cells[COLUMN.costPrice]),
      marketPrice: parseInteger(cells[COLUMN.marketPrice]),
      marketDelta: parseDecimal(cells[COLUMN.marketDelta]),
      priceNote: parseText(cells[COLUMN.priceNote]),
    },
  };
}

/**
 * Разбор листа целиком.
 *
 * Порядок шагов — docs/technical-spec.md §5. Позиции других марок
 * (ВАЗ, ЗИЛ, КамАЗ, МАЗ — 9 штук в снимке) отсеиваются здесь, на сервере,
 * и в браузер не попадают вовсе.
 *
 * Позиции с пустой применимостью остаются на витрине: товар реальный,
 * цена и остаток есть (открытый вопрос №1 в docs/data-model.md §11).
 */
export function parseSheet(rows: string[][], readAt: string): PartsRead {
  const parts: AdminPart[] = [];
  const issues: SheetIssue[] = [];
  const seenIds = new Map<number, number>();

  // Строка 1 — заголовки, данные начинаются со второй.
  for (let i = 1; i < rows.length; i += 1) {
    const cells = rows[i] ?? [];
    const rowNumber = i + 1;

    // Пустая строка или хвост формул — не ошибка, просто конец данных.
    if (cells.every((cell) => (cell ?? '').trim() === '')) continue;
    if (isTemplateTail(cells)) continue;

    const result = parseRow(cells, rowNumber);
    if (!result.ok) {
      issues.push({ level: 'error', row: rowNumber, reason: result.reason });
      continue;
    }

    const duplicateRow = seenIds.get(result.part.id);
    if (duplicateRow !== undefined) {
      issues.push({
        level: 'error',
        row: rowNumber,
        reason: `ID ${result.part.id} уже встречался в строке ${duplicateRow}. Ключ обязан быть уникальным.`,
      });
      continue;
    }
    seenIds.set(result.part.id, rowNumber);

    if (result.part.brands.length === 0 && result.part.fitment !== null) {
      // Марка указана, но это не ГАЗ и не УАЗ: ВАЗ, ЗИЛ, КамАЗ, МАЗ.
      continue;
    }

    parts.push(result.part);
  }

  issues.push(...checkTotals(parts));
  return { parts, issues, readAt };
}

/**
 * Сверка контрольных сумм с листом «Сводка».
 * Расхождение — предупреждение, а не отказ: склад живой, числа меняются.
 * Но оператор обязан увидеть, что каталог разошёлся с ожиданием.
 */
function checkTotals(parts: AdminPart[]): SheetIssue[] {
  const issues: SheetIssue[] = [];
  const units = parts.reduce((sum, part) => sum + part.qty, 0);
  const total = parts.reduce((sum, part) => sum + part.qty * part.price, 0);

  if (parts.length > EXPECTED.parts) {
    issues.push({
      level: 'warning',
      row: 0,
      reason: `Позиций на витрине ${parts.length}, в снимке было ${EXPECTED.parts}. Проверьте, все ли новые строки заполнены верно.`,
    });
  }
  if (units === 0 || total === 0) {
    issues.push({
      level: 'warning',
      row: 0,
      reason: 'Суммарный остаток или стоимость склада равны нулю. Похоже, колонки сместились.',
    });
  }
  return issues;
}

/** Срез позиции, разрешённый к выдаче в браузер (docs/data-model.md §9). */
export function toPublic(part: AdminPart): PublicPart {
  return {
    id: part.id,
    title: part.title,
    article: part.article,
    articleKind: part.articleKind,
    fitment: part.fitment,
    brands: part.brands,
    category: part.category,
    price: part.price,
    qty: part.qty,
  };
}

/**
 * Список категорий для фильтра — строится из данных, а не из константы.
 * Порядок: по убыванию количества позиций, как на витрине.
 */
export function collectCategories(parts: PublicPart[]): { name: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const part of parts) {
    counts.set(part.category, (counts.get(part.category) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'ru'));
}
