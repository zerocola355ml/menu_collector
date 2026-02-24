// ── 테마(다크모드) 관리 유틸리티 ──

const THEME_KEY = "vote-eat-theme";

/** 저장된 테마 또는 시스템 설정 가져오기 */
export const getTheme = () => {
  const saved = localStorage.getItem(THEME_KEY);
  if (saved) return saved;
  // 시스템 다크모드 감지
  if (window.matchMedia?.("(prefers-color-scheme: dark)").matches) {
    return "dark";
  }
  return "light";
};

/** 테마 적용 (HTML data-theme 속성 + localStorage 저장) */
export const setTheme = (theme) => {
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem(THEME_KEY, theme);
};

/** 테마 토글 (light ↔ dark) → 새 테마 반환 */
export const toggleTheme = () => {
  const current = getTheme();
  const next = current === "dark" ? "light" : "dark";
  setTheme(next);
  return next;
};

/** 초기 테마 적용 (앱 마운트 전 호출) */
export const initTheme = () => {
  setTheme(getTheme());
};
