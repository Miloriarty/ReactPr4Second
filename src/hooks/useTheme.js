import { useEffect, useState } from 'react'

/*
 * Тема оформления: 'light' | 'dark'.
 * Пока пользователь не выбирал тему сам - она повторяет системную и меняется вместе с ней.
 * Выбор кнопкой сохраняется в localStorage. Начальное значение атрибута data-theme
 * ставит inline-скрипт в index.html еще до загрузки React (без мигания светлой темы).
 */

export const THEME_KEY = 'cat-therapy-theme'

const systemQuery = () => window.matchMedia('(prefers-color-scheme: dark)')

function readStoredTheme() {
  try {
    const value = localStorage.getItem(THEME_KEY)
    return value === 'light' || value === 'dark' ? value : null
  } catch {
    return null
  }
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme
}

/** Текущая тема и функция переключения. */
export function useTheme() {
  const [theme, setTheme] = useState(
    () => document.documentElement.dataset.theme || readStoredTheme() || (systemQuery().matches ? 'dark' : 'light'),
  )

  // Следим за системной темой, пока пользователь не сделал выбор сам
  useEffect(() => {
    const query = systemQuery()
    const onChange = (event) => {
      if (readStoredTheme()) return
      const next = event.matches ? 'dark' : 'light'
      applyTheme(next)
      setTheme(next)
    }
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])

  function toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark'
    applyTheme(next)
    setTheme(next)
    try {
      localStorage.setItem(THEME_KEY, next)
    } catch {
      // выбор продержится до перезагрузки страницы
    }
  }

  return { theme, toggleTheme }
}
