export function parseIfNoneMatch(ifNoneMatch?: string): number[] {
  if (!ifNoneMatch) {
    return [];
  }

  if (ifNoneMatch.trim() === '*') {
    return [-1];
  }

  return ifNoneMatch
    .split(',')
    .map((value) => value.trim().replace(/^W\//, '').replace(/^"|"$/g, ''))
    .filter((value) => /^\d+$/.test(value))
    .map(Number);
}
