export function isWordSeparator(character: string | undefined) {
  if (character === undefined || character.length === 0) return true;
  return !/[\p{L}\p{N}\p{M}]/u.test(character);
}
