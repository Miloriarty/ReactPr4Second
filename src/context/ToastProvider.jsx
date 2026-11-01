import { useCallback, useMemo, useRef, useState } from 'react'
import { ToastContext } from './contexts.js'

/** Показывает сообщения об ошибках запросов в углу экрана; каждое исчезает через 4 секунды. */
export default function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const nextId = useRef(1)

  const dismiss = useCallback((id) => setToasts((list) => list.filter((t) => t.id !== id)), [])

  const notifyError = useCallback(
    (text) => {
      const id = nextId.current++
      setToasts((list) => [...list.slice(-3), { id, text }])
      setTimeout(() => dismiss(id), 4000)
    },
    [dismiss],
  )

  const value = useMemo(() => ({ notifyError }), [notifyError])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toasts" role="alert" aria-live="assertive">
        {toasts.map((t) => (
          <button key={t.id} type="button" className="toast" onClick={() => dismiss(t.id)}>
            {t.text}
          </button>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
