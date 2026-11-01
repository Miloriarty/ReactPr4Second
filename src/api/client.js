/*
 * HTTP-клиент для работы с API сервера (/api проксируется Vite на Express).
 * Все запросы проходят через request(): он подставляет токен, разбирает JSON
 * и превращает любые сбои в ApiError с понятным пользователю сообщением.
 */

const TOKEN_KEY = 'cat-therapy-token'

/** Ошибка запроса к API: status (0 - сервер недоступен) и ошибки по полям формы. */
export class ApiError extends Error {
  constructor(message, status, fields) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.fields = fields || {}
  }
}

/** Хранилище токена. localStorage может быть недоступен (приватный режим) - тогда просто живем без него. */
export const tokenStorage = {
  get() {
    try {
      return localStorage.getItem(TOKEN_KEY)
    } catch {
      return null
    }
  },
  set(token) {
    try {
      localStorage.setItem(TOKEN_KEY, token)
    } catch {
      // токен останется только до перезагрузки страницы
    }
  },
  clear() {
    try {
      localStorage.removeItem(TOKEN_KEY)
    } catch {
      // нечего очищать
    }
  },
}

let unauthorizedHandler = null

/** Регистрирует обработчик "сессия истекла" (401 при наличии токена). Его ставит AuthProvider. */
export function setUnauthorizedHandler(handler) {
  unauthorizedHandler = handler
}

/**
 * Выполняет запрос к API.
 * @param {string} path путь без префикса /api, например '/services'
 * @param {{method?: string, body?: object, params?: object, signal?: AbortSignal}} options
 * @returns {Promise<any>} разобранный JSON (или null для 204)
 * @throws {ApiError}
 */
export async function request(path, { method = 'GET', body, params, signal } = {}) {
  const url = new URL(`/api${path}`, window.location.origin)
  for (const [key, value] of Object.entries(params || {})) {
    if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, value)
  }

  const token = tokenStorage.get()
  const headers = {}
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (token) headers.Authorization = `Bearer ${token}`

  let response
  try {
    response = await fetch(url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal,
    })
  } catch (err) {
    if (err.name === 'AbortError') throw err
    throw new ApiError('Не удалось связаться с сервером. Проверьте подключение и попробуйте ещё раз', 0)
  }

  if (response.status === 204) return null

  let data = null
  try {
    data = await response.json()
  } catch {
    // сервер вернул не JSON (например, прокси выдал HTML-страницу ошибки)
  }

  if (!response.ok) {
    if (response.status === 401 && token && unauthorizedHandler) {
      unauthorizedHandler(data?.error || 'Сессия истекла, войдите снова')
    }
    const message =
      data?.error ||
      (response.status >= 500 ? 'Сервер временно недоступен, попробуйте позже' : `Ошибка запроса (${response.status})`)
    throw new ApiError(message, response.status, data?.fields)
  }
  return data
}

/** Короткие обертки над request() для каждого HTTP-метода. */
export const api = {
  get: (path, params, signal) => request(path, { params, signal }),
  post: (path, body) => request(path, { method: 'POST', body: body ?? {} }),
  put: (path, body) => request(path, { method: 'PUT', body }),
  patch: (path, body) => request(path, { method: 'PATCH', body }),
  del: (path) => request(path, { method: 'DELETE' }),
}
