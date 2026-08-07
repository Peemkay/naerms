export function toIsoDate(date: Date | null | undefined): string | null {
  if (!date) return null
  return date.toISOString().slice(0, 10)
}
