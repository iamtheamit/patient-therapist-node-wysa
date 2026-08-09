import crypto from 'crypto';

/**
 * Generates a deterministic pair of 32-bit signed integers (key1, key2) for PostgreSQL pg_advisory_xact_lock(key1, key2).
 * Derived from therapistId, startTime, and endTime.
 */
export function generateSlotLockKey(
  therapistId: string,
  startTime: Date,
  endTime: Date
): { key1: number; key2: number } {
  const input = `${therapistId}:${startTime.toISOString()}:${endTime.toISOString()}`;
  const hash = crypto.createHash('sha256').update(input).digest();
  const key1 = hash.readInt32BE(0);
  const key2 = hash.readInt32BE(4);
  return { key1, key2 };
}
