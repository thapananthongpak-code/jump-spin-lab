const pad = (n: number) => String(n).padStart(2, '0');

export function formatDateTime(ms: number): string {
  const d = new Date(ms);
  return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear() % 100} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function formatCm(v: number): string {
  return v.toFixed(1);
}

export function formatDeg(v: number): string {
  return String(Math.round(v));
}

export function rotationsText(deg: number): string {
  const r = deg / 360;
  return r >= 0.25 ? `${r.toFixed(1)} turns` : '';
}
