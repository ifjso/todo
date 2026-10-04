import { generateKeyBetween } from "fractional-indexing";

/** a < 결과 < b 인 order 키를 만든다. a/b 가 null 이면 해당 방향은 열려 있다. */
export function orderBetween(a: string | null | undefined, b: string | null | undefined): string {
  return generateKeyBetween(a ?? null, b ?? null);
}

/** 정렬된 목록의 맨 끝에 붙일 order 키 */
export function orderAfter(last: string | null | undefined): string {
  return generateKeyBetween(last ?? null, null);
}

export const MAX_ORDER_LENGTH = 256;

/** fractional-indexing 이 해석할 수 있는 키인지 검사한다. */
export function isValidOrderKey(key: string): boolean {
  if (key.length === 0 || key.length > MAX_ORDER_LENGTH) return false;
  try {
    generateKeyBetween(key, null);
    return true;
  } catch {
    return false;
  }
}

/** 문자열 사전순 비교 (localeCompare 는 대소문자를 섞어 정렬하므로 사용하지 않는다) */
export function compareOrder(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
