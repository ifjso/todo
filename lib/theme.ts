export type ThemePreference = "light" | "dark" | "system";

export const THEME_STORAGE_KEY = "theme";
export const THEME_PREFERENCES: ThemePreference[] = ["system", "light", "dark"];

const THEME_EVENT = "themechange";
const DARK_QUERY = "(prefers-color-scheme: dark)";

function isPreference(value: unknown): value is ThemePreference {
  return value === "light" || value === "dark" || value === "system";
}

export function readThemePreference(): ThemePreference {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return isPreference(stored) ? stored : "system";
  } catch {
    return "system";
  }
}

export function resolveDark(preference: ThemePreference): boolean {
  return preference === "dark" || (preference === "system" && window.matchMedia(DARK_QUERY).matches);
}

export function applyTheme(preference: ThemePreference): void {
  document.documentElement.classList.toggle("dark", resolveDark(preference));
}

export function setThemePreference(preference: ThemePreference): void {
  try {
    if (preference === "system") localStorage.removeItem(THEME_STORAGE_KEY);
    else localStorage.setItem(THEME_STORAGE_KEY, preference);
  } catch {
    // 저장소를 쓸 수 없어도 현재 화면에는 적용한다.
  }
  applyTheme(preference);
  window.dispatchEvent(new Event(THEME_EVENT));
}

/** useSyncExternalStore 용: 이 탭/다른 탭의 선택 변경과 OS 설정 변경을 구독한다. */
export function subscribeTheme(onChange: () => void): () => void {
  const media = window.matchMedia(DARK_QUERY);
  const sync = () => {
    applyTheme(readThemePreference());
    onChange();
  };
  window.addEventListener(THEME_EVENT, onChange);
  window.addEventListener("storage", sync);
  media.addEventListener("change", sync);
  return () => {
    window.removeEventListener(THEME_EVENT, onChange);
    window.removeEventListener("storage", sync);
    media.removeEventListener("change", sync);
  };
}

/** 첫 페인트 전에 <html> 에 dark 클래스를 붙여 화면 깜빡임을 막는 인라인 스크립트 */
export const themeInitScript = `(function(){try{var t=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});var d=t==="dark"||(t!=="light"&&window.matchMedia(${JSON.stringify(DARK_QUERY)}).matches);document.documentElement.classList.toggle("dark",d)}catch(e){}})();`;
