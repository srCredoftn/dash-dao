/**
 * Utilities for rendering notification summaries consistently across the app.
 */
export function formatNotificationMessage(message: string): string[] {
  const rawLines = message
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  const MAX_LINES = 6;
  const MAX_LENGTH = 160;

  const formatted: string[] = [];
  for (const line of rawLines) {
    if (formatted.length >= MAX_LINES) break;
    formatted.push(
      line.length > MAX_LENGTH ? `${line.slice(0, MAX_LENGTH - 1)}…` : line,
    );
  }

  if (rawLines.length > MAX_LINES) {
    formatted.push("…");
  }

  return formatted;
}
