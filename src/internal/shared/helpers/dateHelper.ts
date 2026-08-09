/**
 * Calculates start (00:00:00.000) and end (23:59:59.999) Date boundaries for a given date.
 */
export function getTodayDateBounds(referenceDate: Date = new Date()): { todayStart: Date; todayEnd: Date } {
  const year = referenceDate.getFullYear();
  const month = referenceDate.getMonth();
  const date = referenceDate.getDate();

  return {
    todayStart: new Date(year, month, date, 0, 0, 0, 0),
    todayEnd: new Date(year, month, date, 23, 59, 59, 999),
  };
}

/**
 * Parses a date string (either 'YYYY-MM-DD' or ISO format) into a Date object.
 */
export function parseDateString(dateStr: string, isEndOfDay: boolean = false): Date {
  if (dateStr.length <= 10) {
    const [y, m, d] = dateStr.split('-').map(Number);
    if (isEndOfDay) {
      return new Date(y, m - 1, d, 23, 59, 59, 999);
    }
    return new Date(y, m - 1, d, 0, 0, 0, 0);
  }
  return new Date(dateStr);
}
