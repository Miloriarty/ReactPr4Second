import { HttpError } from '../utils/HttpError.js'

/** 404 для неизвестных маршрутов API. */
export function notFoundHandler(req, res) {
  res.status(404).json({ error: `Маршрут ${req.method} ${req.originalUrl} не найден` })
}

/**
 * Единый обработчик ошибок. Любая ошибка превращается в JSON { error, fields? },
 * чтобы фронтенд мог одинаково показывать сообщения.
 */
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message, fields: err.fields })
  }

  // Битый JSON в теле запроса
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Некорректный JSON в теле запроса' })
  }
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Слишком большой запрос' })
  }

  // Ошибки ограничений PostgreSQL - на случай гонок, которые не поймала валидация
  switch (err.code) {
    case '23505':
      return res.status(409).json({ error: 'Такая запись уже существует' })
    case '23503':
      return res.status(409).json({ error: 'Операция невозможна: есть связанные данные' })
    case '23514':
    case '22P02':
    case '22003':
      return res.status(400).json({ error: 'Некорректные данные' })
  }

  console.error(err)
  res.status(500).json({ error: 'Внутренняя ошибка сервера, попробуйте позже' })
}
