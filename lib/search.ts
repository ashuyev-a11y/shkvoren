/**
 * Поиск по каталогу.
 *
 * Выполняется в памяти по кэшированному массиву: позиций 269, полный проход
 * занимает доли миллисекунды (docs/technical-spec.md §7). Внешний поисковый
 * движок и Postgres с pg_trgm не нужны.
 *
 * Порядок результатов задан в docs/data-model.md §5:
 *   1. точное совпадение нормализованного артикула;
 *   2. артикул начинается с запроса;
 *   3. артикул содержит запрос;
 *   4. триграммное сходство наименования.
 */
// Пути относительные, а не через алиас @/: модули lib/ импортируются
// не только Next.js, но и тестами через node --test, который алиас не знает.
import { normalizeArticle } from './parts.ts';
import type { AdminPart } from '../types/part.ts';

/** Минимальная длина запроса. Короче — искать нечего, вернётся пусто. */
export const MIN_QUERY_LENGTH = 2;

/**
 * Минимальная длина для поиска по части номера.
 *
 * Три знака дают слишком много попаданий: «350» содержится в десятках
 * артикулов и выдача перестаёт быть полезной.
 */
const MIN_PARTIAL_LENGTH = 4;

/** Порог триграммного сходства наименования. Ниже — совпадение случайное. */
const TRIGRAM_THRESHOLD = 0.3;

/** Вес совпадения: чем меньше число, тем выше позиция в выдаче. */
const RANK = {
  articleExact: 0,
  articlePrefix: 1,
  articleContains: 2,
  titleExact: 3,
  titleWords: 4,
  titleTrigram: 5,
} as const;

/**
 * Приведение поискового запроса к виду наименования: нижний регистр,
 * кириллическая «ё» к «е», лишние пробелы убраны.
 */
function normalizeText(value: string): string {
  return value.toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ').trim();
}

/** Триграммы строки. Края дополняются пробелами, чтобы начало слова весило больше. */
function trigrams(value: string): Set<string> {
  const padded = `  ${value} `;
  const result = new Set<string>();
  for (let i = 0; i < padded.length - 2; i += 1) {
    result.add(padded.slice(i, i + 3));
  }
  return result;
}

/**
 * Коэффициент Дайса: доля общих триграмм.
 * Возвращает число от 0 до 1.
 */
export function trigramSimilarity(left: string, right: string): number {
  const a = trigrams(normalizeText(left));
  const b = trigrams(normalizeText(right));
  if (a.size === 0 || b.size === 0) return 0;

  let shared = 0;
  for (const gram of a) if (b.has(gram)) shared += 1;

  return (2 * shared) / (a.size + b.size);
}

/** Совпадение позиции с запросом: вес и величина сходства. */
type Match = { rank: number; score: number };

/**
 * Сопоставить одну позицию с запросом.
 * Возвращает null, если позиция не подходит.
 */
function matchPart(
  part: AdminPart,
  queryNorm: string,
  queryArticle: string,
  queryWords: string[]
): Match | null {
  // --- По артикулу ---------------------------------------------------------
  if (queryArticle.length > 0 && part.articleNorm.length > 0) {
    if (part.articleNorm === queryArticle) {
      return { rank: RANK.articleExact, score: 1 };
    }
    if (queryArticle.length >= MIN_PARTIAL_LENGTH) {
      if (part.articleNorm.startsWith(queryArticle)) {
        return { rank: RANK.articlePrefix, score: queryArticle.length / part.articleNorm.length };
      }
      if (part.articleNorm.includes(queryArticle)) {
        return { rank: RANK.articleContains, score: queryArticle.length / part.articleNorm.length };
      }
    }
  }

  // --- По наименованию -----------------------------------------------------
  const titleNorm = normalizeText(part.title);

  if (titleNorm === queryNorm) {
    return { rank: RANK.titleExact, score: 1 };
  }

  // Все слова запроса присутствуют в наименовании — запрос «шкворень уаз»
  // обязан находить «Шкворень поворотного кулака УАЗ».
  if (queryWords.length > 0 && queryWords.every((word) => titleNorm.includes(word))) {
    return { rank: RANK.titleWords, score: queryNorm.length / titleNorm.length };
  }

  // Опечатка или другое окончание: «тормазной» вместо «тормозной».
  const similarity = trigramSimilarity(queryNorm, titleNorm);
  if (similarity >= TRIGRAM_THRESHOLD) {
    return { rank: RANK.titleTrigram, score: similarity };
  }

  // Применимость ищется только как дополнение к тексту запроса,
  // отдельным критерием не является: иначе запрос «УАЗ» выдаст весь каталог.
  return null;
}

/**
 * Найти позиции по запросу.
 *
 * Порядок стабилен: при равном весе и сходстве позиции идут по возрастанию ID,
 * то есть в порядке строк таблицы. Случайной перестановки выдачи между
 * запросами не происходит.
 */
export function searchParts(parts: AdminPart[], query: string, limit = 50): AdminPart[] {
  const queryNorm = normalizeText(query);
  if (queryNorm.length < MIN_QUERY_LENGTH) return [];

  const queryArticle = normalizeArticle(query);
  const queryWords = queryNorm.split(' ').filter((word) => word.length > 0);

  const found: { part: AdminPart; match: Match }[] = [];
  for (const part of parts) {
    const match = matchPart(part, queryNorm, queryArticle, queryWords);
    if (match !== null) found.push({ part, match });
  }

  // Триграммное сходство — запасной путь на случай опечатки, а не дополнение
  // к точной выдаче. Если нашлись позиции по номеру или по всем словам запроса,
  // похожие по написанию отбрасываются: на «тормозной барабан» покупатель
  // должен получить барабан, а не весь тормозной узел.
  const exact = found.filter((item) => item.match.rank < RANK.titleTrigram);
  const result = exact.length > 0 ? exact : found;

  result.sort(
    (a, b) =>
      a.match.rank - b.match.rank ||
      b.match.score - a.match.score ||
      a.part.id - b.part.id
  );

  return result.slice(0, limit).map((item) => item.part);
}
