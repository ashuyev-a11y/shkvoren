/**
 * Минимальный читатель .xlsx — только то, что нужно проекту.
 *
 * Нужен, чтобы извлечь из снимка «Запчасти_с_ценами_рынка (2).xlsx» реальные
 * строки для тестов. Внешняя зависимость ради одной разовой операции не берётся
 * (docs/technical-spec.md §2), поэтому zip и XML разбираются вручную:
 * xlsx — это zip с deflate-записями, а node:zlib умеет inflateRaw.
 *
 * Ограничения осознанные: читаются только значения ячеек (общие строки и числа),
 * формулы игнорируются — в модель данных они не входят (docs/data-model.md §2).
 */
import { readFileSync } from 'node:fs';
import { inflateRawSync } from 'node:zlib';

/** Распаковать zip в Map<имя файла, Buffer>. */
function unzip(buffer) {
  const files = new Map();

  // Ищем сигнатуру конца центрального каталога (EOCD) с конца файла.
  let eocd = -1;
  for (let i = buffer.length - 22; i >= 0; i -= 1) {
    if (buffer.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error('Это не zip-архив: не найден конец центрального каталога.');

  const entryCount = buffer.readUInt16LE(eocd + 10);
  let offset = buffer.readUInt32LE(eocd + 16);

  for (let n = 0; n < entryCount; n += 1) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) break;

    const method = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localOffset = buffer.readUInt32LE(offset + 42);
    const name = buffer.toString('utf8', offset + 46, offset + 46 + nameLength);

    // Локальный заголовок: длины имени и extra в нём свои, читаем их заново.
    const localNameLength = buffer.readUInt16LE(localOffset + 26);
    const localExtraLength = buffer.readUInt16LE(localOffset + 28);
    const dataStart = localOffset + 30 + localNameLength + localExtraLength;
    const data = buffer.subarray(dataStart, dataStart + compressedSize);

    files.set(name, method === 0 ? data : inflateRawSync(data));
    offset += 46 + nameLength + extraLength + commentLength;
  }

  return files;
}

/** Развернуть XML-сущности. */
function decodeXml(text) {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

/** Буква колонки в индекс: A→0, Z→25, AA→26. */
function columnIndex(letters) {
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

/**
 * Прочитать лист как массив строк-массивов — в том же виде,
 * в каком значения приходят из Google Sheets API.
 *
 * @param {string} path путь к .xlsx
 * @param {string} sheetName имя листа
 * @returns {string[][]}
 */
export function readSheet(path, sheetName) {
  const files = unzip(readFileSync(path));

  // Общие строки: ячейки с t="s" ссылаются на них по индексу.
  const sharedXml = files.get('xl/sharedStrings.xml')?.toString('utf8') ?? '';
  const shared = [...sharedXml.matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) =>
    decodeXml([...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((t) => t[1]).join(''))
  );

  // Порядок листов в workbook.xml соответствует sheetN.xml.
  const workbook = files.get('xl/workbook.xml').toString('utf8');
  const sheets = [...workbook.matchAll(/<sheet[^>]*name="([^"]*)"[^>]*\/>/g)].map((m) =>
    decodeXml(m[1])
  );
  const sheetPosition = sheets.indexOf(sheetName);
  if (sheetPosition < 0) {
    throw new Error(`Лист «${sheetName}» не найден. Есть: ${sheets.join(', ')}`);
  }

  const sheetXml = files.get(`xl/worksheets/sheet${sheetPosition + 1}.xml`).toString('utf8');
  const rows = [];

  for (const rowMatch of sheetXml.matchAll(/<row[^>]*r="(\d+)"[^>]*>([\s\S]*?)<\/row>/g)) {
    const rowNumber = Number(rowMatch[1]);
    const cells = [];

    // Ячейка бывает самозакрывающейся (<c r="A1" s="3"/>) — это пустое значение.
    for (const cell of rowMatch[2].matchAll(/<c r="([A-Z]+)\d+"([^>/]*)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const index = columnIndex(cell[1]);
      const type = /t="(\w+)"/.exec(cell[2])?.[1];
      const raw = /<v>([\s\S]*?)<\/v>/.exec(cell[3] ?? '')?.[1];

      let value = '';
      if (raw !== undefined) {
        value = type === 's' ? (shared[Number(raw)] ?? '') : decodeXml(raw);
      }
      cells[index] = value;
    }

    // Пустые ячейки в xlsx пропускаются — восстанавливаем их пустыми строками,
    // чтобы форма массива совпадала с ответом Sheets API.
    for (let i = 0; i < cells.length; i += 1) if (cells[i] === undefined) cells[i] = '';

    rows[rowNumber - 1] = cells;
  }

  for (let i = 0; i < rows.length; i += 1) if (rows[i] === undefined) rows[i] = [];
  return rows;
}
