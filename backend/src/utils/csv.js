const DELIMITER = ';';

function escapeCsvField(value) {
  const str = String(value ?? '');
  if (str.includes(DELIMITER) || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function toCsv(rows) {
  return rows.map((row) => row.map(escapeCsvField).join(DELIMITER)).join('\r\n');
}

function parseCsvLine(line) {
  const fields = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === DELIMITER) {
      fields.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  fields.push(current);
  return fields;
}

function parseCsv(text) {
  const lines = String(text || '')
    .split(/\r\n|\n|\r/)
    .filter((line) => line.trim() !== '');
  if (!lines.length) return [];
  return lines.map(parseCsvLine);
}

module.exports = { toCsv, parseCsv, DELIMITER };
