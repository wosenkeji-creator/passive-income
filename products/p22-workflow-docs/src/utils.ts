export function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Expected a JSON object');
  return value as Record<string, unknown>;
}

export function jsonPreview(value: unknown, max = 180): string {
  const text = JSON.stringify(value ?? {});
  return text.length > max ? `${text.slice(0, max - 3)}...` : text;
}

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character] ?? character));
}

export function escapeMarkdown(value: string): string {
  return value.replace(/[|`]/g, '\\$&').replace(/\r?\n/g, ' ');
}
