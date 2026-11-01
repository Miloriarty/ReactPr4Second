import { useEffect } from 'react'

/** Устанавливает заголовок вкладки браузера для текущей страницы. */
export function useTitle(title) {
  useEffect(() => {
    document.title = title ? `${title} — Котики-терапевты` : 'Котики-терапевты на выезд'
  }, [title])
}
