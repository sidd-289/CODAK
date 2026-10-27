export const CURSOR_PREFERENCE_KEY = 'codak_cursor_preference';
export const CURSOR_PREFERENCE_EVENT = 'codak_cursor_preference_change';

export type CursorPreference = 'target' | 'default';

/**
 * Reads the user's cursor preference from localStorage (safely handles SSR and storage restrictions).
 * Defaults to 'target' (custom cyberpunk crosshair cursor).
 */
export function getCursorPreference(): CursorPreference {
  if (typeof window === 'undefined') return 'target';
  try {
    const saved = localStorage.getItem(CURSOR_PREFERENCE_KEY);
    if (saved === 'default') return 'default';
    if (saved === 'target') return 'target';
  } catch {
    // Local storage access blocked or unavailable
  }
  return 'target';
}

/**
 * Saves the cursor preference to localStorage and broadcasts the change event across the app.
 */
export function setCursorPreference(preference: CursorPreference): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(CURSOR_PREFERENCE_KEY, preference);
  } catch {
    // Local storage access blocked or unavailable
  }
  window.dispatchEvent(
    new CustomEvent(CURSOR_PREFERENCE_EVENT, { detail: { preference } })
  );
}
