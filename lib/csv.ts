/**
 * Client-side CSV export helper (admin pages). Values are escaped per RFC 4180
 * and the file is prefixed with a UTF-8 BOM so Excel opens Naira amounts and
 * Arabic characters correctly.
 */

/** Escape a single cell: quote when it contains commas, quotes or newlines. */
export function csvCell(value: string | number): string {
  const text = String(value ?? "");
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

/** Build the CSV body (no BOM). Internal — used by `downloadCsv`. */
function csvBody(rows: (string | number)[][]): string {
  return rows.map((row) => row.map(csvCell).join(",")).join("\n");
}

/** Trigger a browser download of a CSV file. */
export function downloadCsv(filename: string, rows: (string | number)[][]): void {
  const blob = new Blob([`\uFEFF${csvBody(rows)}`], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

/** Stable YYYY-MM-DD for CSV files (locale-independent). */
export function csvDate(ts: number): string {
  const d = new Date(ts);
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${month}-${day}`;
}
