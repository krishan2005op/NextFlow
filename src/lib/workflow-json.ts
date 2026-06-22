export function parseStoredJson<T>(value: unknown, fallback: T): T {
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  }

  if (value == null) {
    return fallback;
  }

  return value as T;
}
