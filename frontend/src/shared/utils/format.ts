export function formatDateTime(value: string | null | undefined): string {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "short",
    timeStyle: "medium"
  }).format(date);
}

export function formatDurationMs(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return "—";
  }

  if (value < 1000) {
    return `${value} мс`;
  }

  const seconds = value / 1000;

  if (seconds < 60) {
    return `${seconds.toFixed(1)} с`;
  }

  const minutes = Math.floor(seconds / 60);
  const rest = Math.round(seconds % 60);

  return `${minutes} мин ${rest} с`;
}

export function formatBytes(value: number): string {
  if (value < 1024) {
    return `${value} Б`;
  }

  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} КБ`;
  }

  return `${(value / (1024 * 1024)).toFixed(1)} МБ`;
}

export function stringifyJson(value: unknown): string {
  if (value === null || value === undefined) {
    return "—";
  }

  if (typeof value === "string") {
    return value;
  }

  return JSON.stringify(value, null, 2);
}