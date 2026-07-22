export type InzyteJsonRecord = Record<string, unknown>;

export const isInzyteRecord = (value: unknown): value is InzyteJsonRecord =>
  value !== null && typeof value === "object" && !Array.isArray(value);

export const unwrapInzyteData = (value: unknown): unknown => {
  let current = value;
  for (let depth = 0; depth < 4; depth += 1) {
    if (!isInzyteRecord(current)) break;
    if ("data" in current && current.data !== undefined) {
      current = current.data;
      continue;
    }
    if ("result" in current && current.result !== undefined) {
      current = current.result;
      continue;
    }
    break;
  }
  return current;
};

export const findNamedArray = (
  value: unknown,
  preferredKeys: string[],
  depth = 0,
): InzyteJsonRecord[] => {
  if (depth > 7) return [];
  if (Array.isArray(value)) return value.filter(isInzyteRecord);
  if (!isInzyteRecord(value)) return [];
  for (const key of preferredKeys) {
    if (Array.isArray(value[key])) {
      return (value[key] as unknown[]).filter(isInzyteRecord);
    }
  }
  for (const child of Object.values(value)) {
    const found = findNamedArray(child, preferredKeys, depth + 1);
    if (found.length > 0) return found;
  }
  return [];
};
