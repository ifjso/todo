const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** 로컬 날짜를 YYYY-MM-DD 로 포맷한다. */
export function formatDate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** YYYY-MM-DD 를 로컬 자정 Date 로 파싱한다. 형식이 틀리거나 존재하지 않는 날짜면 null. */
export function parseDate(value: string): Date | null {
  if (!DATE_RE.test(value)) return null;
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) {
    return null;
  }
  return date;
}

export function isDateString(value: unknown): value is string {
  return typeof value === "string" && parseDate(value) !== null;
}

/** 주어진 날짜가 속한 주의 월요일(YYYY-MM-DD)을 반환한다. */
export function getWeekStart(date: Date = new Date()): string {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diff = (d.getDay() + 6) % 7; // 월=0 ... 일=6
  d.setDate(d.getDate() - diff);
  return formatDate(d);
}

/** weekStart(월요일)부터 offset 일 뒤의 날짜 */
export function addDays(dateString: string, offset: number): string {
  const d = parseDate(dateString);
  if (!d) throw new Error(`잘못된 날짜: ${dateString}`);
  d.setDate(d.getDate() + offset);
  return formatDate(d);
}

/** 월요일 시작 순서의 요일 (dayOfWeek 값: 0=일 ... 6=토) */
export const WEEK_DAYS: { dayOfWeek: number; label: string; offset: number }[] = [
  { dayOfWeek: 1, label: "월", offset: 0 },
  { dayOfWeek: 2, label: "화", offset: 1 },
  { dayOfWeek: 3, label: "수", offset: 2 },
  { dayOfWeek: 4, label: "목", offset: 3 },
  { dayOfWeek: 5, label: "금", offset: 4 },
  { dayOfWeek: 6, label: "토", offset: 5 },
  { dayOfWeek: 0, label: "일", offset: 6 },
];

/** "2026-09-28" → "2026.09.28 ~ 10.04" */
export function formatWeekRange(weekStart: string): string {
  const end = addDays(weekStart, 6);
  return `${weekStart.replaceAll("-", ".")} ~ ${end.slice(5).replace("-", ".")}`;
}
