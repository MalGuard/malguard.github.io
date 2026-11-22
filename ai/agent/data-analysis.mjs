const formatter = new Intl.NumberFormat('en', {maximumFractionDigits: 5});

function readRows(source) {
  if (source.length > 2_000_000) throw new Error('Choose a CSV file smaller than 2 MB.');
  const text = source.replace(/^\uFEFF/, '');
  const rows = [];
  let row = [], field = '', quoted = false, closed = false;
  const finishRow = () => {
    row.push(field);
    if (row.some(value => value.trim())) rows.push(row);
    if (rows.length > 50_001) throw new Error('Choose a CSV with at most 50,000 data rows.');
    row = []; field = ''; closed = false;
  };
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch !== '"') field += ch;
      else if (text[i + 1] === '"') { field += '"'; i++; }
      else { quoted = false; closed = true; }
    } else if (ch === ',') {
      row.push(field);
      if (row.length >= 256) throw new Error('Choose a CSV with at most 256 columns.');
      field = ''; closed = false;
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      finishRow();
    } else if (ch === '"' && !field && !closed) quoted = true;
    else if (closed || ch === '"') throw new Error('Check the quotation marks in the CSV.');
    else field += ch;
  }
  if (quoted) throw new Error('A quoted CSV field is incomplete.');
  finishRow();
  return rows;
}

export function summarizeCsv(source) {
  const [headers, ...rows] = readRows(source);
  if (!headers || !rows.length) throw new Error('Include a header and at least one data row.');
  const invalid = rows.findIndex(row => row.length !== headers.length);
  if (invalid !== -1) throw new Error('Column count differs from the header in data row ' + (invalid + 1) + '.');
  const lines = [formatter.format(rows.length) + ' rows · ' + headers.length + ' columns'];
  headers.forEach((header, index) => {
    let count = 0, numeric = true, mean = 0, min = Infinity, max = -Infinity;
    for (const row of rows) {
      const raw = row[index].trim();
      if (!raw) continue;
      count++;
      const value = Number(raw);
      if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(raw) || !Number.isFinite(value)) numeric = false;
      else {
        mean = mean * ((count - 1) / count) + value / count;
        min = Math.min(min, value);
        max = Math.max(max, value);
      }
    }
    let summary = (header.trim() || 'Column ' + (index + 1)) + ' — ' + (rows.length - count) + ' missing';
    if (numeric && count) summary += ', min ' + formatter.format(min) + ', max ' + formatter.format(max) + ', mean ' + formatter.format(mean);
    lines.push(summary);
  });
  return lines.join('\n');
}
