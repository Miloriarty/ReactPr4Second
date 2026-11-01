/**
 * Ошибка с HTTP-статусом. Бросается из обработчиков и превращается
 * в JSON-ответ { error, fields? } в errorHandler.
 */
export class HttpError extends Error {
  /**
   * @param {number} status HTTP-код ответа
   * @param {string} message сообщение для пользователя
   * @param {Record<string,string>} [fields] ошибки по конкретным полям формы
   */
  constructor(status, message, fields) {
    super(message)
    this.status = status
    this.fields = fields
  }
}

export const badRequest = (message, fields) => new HttpError(400, message, fields)
export const unauthorized = (message = 'Требуется авторизация') => new HttpError(401, message)
export const forbidden = (message = 'Недостаточно прав') => new HttpError(403, message)
export const notFound = (message = 'Не найдено') => new HttpError(404, message)
export const conflict = (message, fields) => new HttpError(409, message, fields)
