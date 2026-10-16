export const APPEARANCE_RESET_EVENT = "mem0:reset-appearance";
export const TEMP_LOCALE_KEY = "mem0.session.locale";
export const TEMP_THEME_KEY = "mem0.session.theme";

export function resetTemporaryAppearance() {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(TEMP_LOCALE_KEY);
    sessionStorage.removeItem(TEMP_THEME_KEY);
  } catch {
    // In-memory overrides are still reset if browser storage is unavailable.
  }
  window.dispatchEvent(new Event(APPEARANCE_RESET_EVENT));
}
