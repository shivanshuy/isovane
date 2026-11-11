import { useEffect, useState } from 'react'
import { APP_THEMES, type AppTheme } from '../config'
import { STORAGE_THEME } from '../constants'

export function useTheme() {
  const [theme, setTheme] = useState<AppTheme>(() => {
    if (typeof window === 'undefined') return 'red-dwarf'
    const stored = window.localStorage.getItem(STORAGE_THEME)
    if (stored === 'white-dwarf') return 'red-dwarf'
    if (APP_THEMES.some((item) => item.id === stored)) return stored as AppTheme
    return 'red-dwarf'
  })

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    window.localStorage.setItem(STORAGE_THEME, theme)
  }, [theme])

  return { theme, setTheme, themes: APP_THEMES }
}
