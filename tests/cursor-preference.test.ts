import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Cursor Preference System & Profile Integration', () => {
  let mockStorage: Record<string, string> = {};
  let originalWindow: any;
  let originalLocalStorage: any;

  beforeEach(() => {
    mockStorage = {};
    originalWindow = (globalThis as any).window;
    originalLocalStorage = (globalThis as any).localStorage;

    const listeners: Record<string, ((e: any) => void)[]> = {};

    const mockLocalStorage = {
      getItem: (key: string) => mockStorage[key] || null,
      setItem: (key: string, value: string) => {
        mockStorage[key] = String(value);
      },
      removeItem: (key: string) => {
        delete mockStorage[key];
      },
      clear: () => {
        mockStorage = {};
      },
    };

    const mockWin = {
      localStorage: mockLocalStorage,
      addEventListener: (type: string, cb: any) => {
        listeners[type] = listeners[type] || [];
        listeners[type].push(cb);
      },
      removeEventListener: (type: string, cb: any) => {
        if (!listeners[type]) return;
        listeners[type] = listeners[type].filter((l) => l !== cb);
      },
      dispatchEvent: (event: any) => {
        const type = event.type;
        (listeners[type] || []).forEach((cb) => cb(event));
        return true;
      },
      CustomEvent: class CustomEvent {
        type: string;
        detail: any;
        constructor(type: string, init?: any) {
          this.type = type;
          this.detail = init?.detail;
        }
      },
    };

    (globalThis as any).window = mockWin;
    (globalThis as any).localStorage = mockLocalStorage;
    (globalThis as any).CustomEvent = mockWin.CustomEvent;
  });

  afterEach(() => {
    (globalThis as any).window = originalWindow;
    (globalThis as any).localStorage = originalLocalStorage;
    delete (globalThis as any).CustomEvent;
    vi.restoreAllMocks();
  });

  describe('1. Cursor Preference Utility (lib/cursor-preference.ts)', () => {
    it('defaults to "target" cursor if no preference is saved', async () => {
      const { getCursorPreference } = await import('@/lib/cursor-preference');
      expect(getCursorPreference()).toBe('target');
    });

    it('returns "default" when user explicitly chooses default cursor', async () => {
      const { getCursorPreference, setCursorPreference, CURSOR_PREFERENCE_KEY } =
        await import('@/lib/cursor-preference');
      setCursorPreference('default');
      expect((globalThis as any).localStorage.getItem(CURSOR_PREFERENCE_KEY)).toBe('default');
      expect(getCursorPreference()).toBe('default');
    });

    it('returns "target" when switched back to target reticle', async () => {
      const { getCursorPreference, setCursorPreference, CURSOR_PREFERENCE_KEY } =
        await import('@/lib/cursor-preference');
      setCursorPreference('default');
      expect(getCursorPreference()).toBe('default');

      setCursorPreference('target');
      expect((globalThis as any).localStorage.getItem(CURSOR_PREFERENCE_KEY)).toBe('target');
      expect(getCursorPreference()).toBe('target');
    });

    it('broadcasts CURSOR_PREFERENCE_EVENT on window when preference changes', async () => {
      const { setCursorPreference, CURSOR_PREFERENCE_EVENT } = await import('@/lib/cursor-preference');
      const listener = vi.fn();
      (globalThis as any).window.addEventListener(CURSOR_PREFERENCE_EVENT, listener);

      setCursorPreference('default');
      expect(listener).toHaveBeenCalledTimes(1);
      const eventDetail = listener.mock.calls[0][0].detail;
      expect(eventDetail.preference).toBe('default');

      setCursorPreference('target');
      expect(listener).toHaveBeenCalledTimes(2);
      expect(listener.mock.calls[1][0].detail.preference).toBe('target');

      (globalThis as any).window.removeEventListener(CURSOR_PREFERENCE_EVENT, listener);
    });
  });

  describe('2. TargetCursor Component Integration (src/components/ui/TargetCursor.tsx)', () => {
    it('reads and subscribes to cursor preference in TargetCursor', () => {
      const filePath = path.resolve(process.cwd(), 'src/components/ui/TargetCursor.tsx');
      const content = fs.readFileSync(filePath, 'utf8');

      expect(content).toContain('getCursorPreference');
      expect(content).toContain('CURSOR_PREFERENCE_EVENT');
      expect(content).toContain('cursorPreference');
      expect(content).toContain("cursorPreference === 'default'");
      // Ensures the component renders null when default cursor is preferred
      expect(content).toContain("if (!host || cursorPreference === 'default') return null;");
      // Preserves existing security/game invariants
      expect(content).toContain(':not(.battle-arena)');
      expect(content).toContain(':not([data-katana-active])');
      expect(content).toContain('isKatanaZone');
    });
  });

  describe('3. Student Profile Page Option (src/app/student/profile/page.tsx)', () => {
    it('contains the Cursor Style settings section with option to turn cursor back to default', () => {
      const filePath = path.resolve(process.cwd(), 'src/app/student/profile/page.tsx');
      const content = fs.readFileSync(filePath, 'utf8');

      // Check section exists and is accessible
      expect(content).toContain('aria-label="Cursor style settings"');
      expect(content).toContain('Cursor Style');
      expect(content).toContain('cursor-option-default');
      expect(content).toContain('Default Cursor');
      expect(content).toContain('Target HUD');

      // Check toggle logic
      expect(content).toContain('student-detail-cursor-toggle');
      expect(content).toContain('handleToggleCursor');
      expect(content).toContain("handleToggleCursor('default')");
      expect(content).toContain("handleToggleCursor('target')");
      expect(content).toContain('cursorPreference');
    });
  });

  describe('4. Dashboard Profile Card Option (src/components/academy/ProfileCard.tsx)', () => {
    it('contains the cursor toggle control on the back of the profile card', () => {
      const filePath = path.resolve(process.cwd(), 'src/components/academy/ProfileCard.tsx');
      const content = fs.readFileSync(filePath, 'utf8');

      expect(content).toContain('handleToggleCursor');
      expect(content).toContain("handleToggleCursor('default')");
      expect(content).toContain("handleToggleCursor('target')");
      expect(content).toContain('Turn cursor back to default OS pointer');
    });
  });
});
