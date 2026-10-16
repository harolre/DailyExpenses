import { useCallback, useEffect, useState } from 'react'

export type ThemePreference = 'light' | 'dark' | 'system'

const storageKey = 'finanzas.theme'

function readThemePreference(): ThemePreference {
  try {
    const saved = localStorage.getItem(storageKey)
    if (saved === 'light' || saved === 'dark' || saved === 'system') return saved
  } catch {
    // The app can still use the system theme when browser storage is unavailable.
  }
  return 'system'
}

function applyTheme(preference: ThemePreference) {
  const isDark = preference === 'dark' || (preference === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.dataset.theme = isDark ? 'dark' : 'light'
  document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')?.setAttribute('content', isDark ? '#10151b' : '#f6f7f8')
}

export function useThemePreference() {
  const [preference, setPreference] = useState<ThemePreference>(readThemePreference)

  useEffect(() => {
    applyTheme(preference)
    if (preference !== 'system') return

    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const update = () => applyTheme('system')
    media.addEventListener?.('change', update)
    return () => media.removeEventListener?.('change', update)
  }, [preference])

  const savePreference = useCallback((next: ThemePreference) => {
    try {
      localStorage.setItem(storageKey, next)
    } catch {
      // The selected theme still applies until this page is closed.
    }
    setPreference(next)
  }, [])

  return [preference, savePreference] as const
}
