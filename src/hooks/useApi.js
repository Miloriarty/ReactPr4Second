import { useCallback, useEffect, useState } from 'react'

/**
 * Загружает данные из API при монтировании и при изменении deps.
 * Возвращает { data, loading, error, reload, setData }.
 * Предыдущий запрос отменяется (AbortController), если deps поменялись раньше, чем пришел ответ.
 *
 * @param {(signal: AbortSignal) => Promise<any>} loader функция запроса
 * @param {any[]} deps зависимости, при смене которых данные перезагружаются
 */
export function useApi(loader, deps) {
  const [state, setState] = useState({ data: null, loading: true, error: null })
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    setState((prev) => ({ ...prev, loading: true, error: null }))
    loader(controller.signal)
      .then((data) => setState({ data, loading: false, error: null }))
      .catch((error) => {
        if (error.name === 'AbortError') return
        setState({ data: null, loading: false, error })
      })
    return () => controller.abort()
    // loader намеренно не в зависимостях - он создается заново на каждый рендер
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, reloadKey])

  const reload = useCallback(() => setReloadKey((k) => k + 1), [])
  const setData = useCallback(
    (update) => setState((prev) =>
        ({ ...prev, data: typeof update === 'function' ? update(prev.data) : update })
    ),
    [],
  )

  return { ...state, reload, setData }
}
