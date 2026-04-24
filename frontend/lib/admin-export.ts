export function downloadCSV(data: Record<string, unknown>[], columns: { key: string; label: string }[], filename: string) {
  const BOM = '﻿';
  const header = columns.map((c) => c.label).join(',');
  const rows = data.map((row) =>
    columns.map((c) => {
      const val = String(row[c.key] ?? '');
      return val.includes(',') || val.includes('\n') || val.includes('"')
        ? `"${val.replace(/"/g, '""')}"`
        : val;
    }).join(',')
  );
  const csv = BOM + [header, ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
