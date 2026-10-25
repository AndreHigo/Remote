const MAX_DEVICE_TAGS = 20;

export function normalizeDeviceTags(values: readonly string[]) {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const tag = value.trim();
    const key = tag.toLocaleLowerCase();
    if (!tag || seen.has(key)) continue;
    seen.add(key);
    result.push(tag);
    if (result.length >= MAX_DEVICE_TAGS) break;
  }

  return result;
}

export { MAX_DEVICE_TAGS };
