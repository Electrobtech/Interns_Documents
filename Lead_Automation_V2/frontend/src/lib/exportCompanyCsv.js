// Client-side CSV export for a single company record — no server round
// trip needed since we already have the full record in memory. Escapes
// quotes/commas/newlines per RFC 4180 so names or addresses containing
// them don't corrupt the file.
function csvCell(value) {
  const str = value === null || value === undefined || value === '' ? 'N/A' : String(value);
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function exportCompanyCsv(company) {
  if (!company) return;

  const rows = [
    ['Field', 'Value'],
    ['Name', company.name],
    ['Email', company.email],
    ['Industry', company.industry],
    ['Plan', company.plan],
    ['Contact Person', company.contactPerson],
    ['Phone', company.phone],
    ['Address', company.address],
    ['Status', company.status],
    ['Registered At', company.registeredAt ? new Date(company.registeredAt).toLocaleString() : 'N/A'],
  ];

  const csv = rows.map((row) => row.map(csvCell).join(',')).join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = `company_${company.id}_details.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}