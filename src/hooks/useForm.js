import { useState } from 'react'
import { validateForm } from '../utils/validators.js'

/**
 * Состояние формы: значения, ошибки по полям, общая ошибка и флаг отправки.
 *
 * - Перед отправкой форма проверяется по schema; запрос не уходит, пока есть ошибки.
 * - Ошибки поля пересчитываются при вводе, если поле уже было с ошибкой.
 * - Ошибки сервера ({ error, fields }) раскладываются по полям автоматически.
 * - Повторная отправка во время запроса игнорируется (защита от двойного клика).
 *
 * @param {object} initialValues начальные значения
 * @param {object} schema правила { поле: [правило, ...] } из utils/validators.js
 */
export function useForm(initialValues, schema) {
  const [values, setValues] = useState(initialValues)
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  /** onChange для input/select/textarea с атрибутом name. */
  function handleChange(event) {
    const { name, type, value, checked } = event.target
    const next = { ...values, [name]: type === 'checkbox' ? checked : value }
    setValues(next)
    if (errors[name]) {
      const fresh = validateForm(next, schema)
      setErrors((prev) => ({ ...prev, [name]: fresh[name] }))
    }
  }

  /** Оборачивает обработчик отправки: preventDefault, валидация, обработка ошибок API. */
  function handleSubmit(onSubmit) {
    return async (event) => {
      event.preventDefault()
      if (submitting) return
      const found = validateForm(values, schema)
      setErrors(found)
      if (Object.keys(found).length > 0) {
        setFormError('Исправьте ошибки в отмеченных полях')
        return
      }
      setFormError(null)
      setSubmitting(true)
      try {
        await onSubmit(values)
      } catch (err) {
        setErrors(err.fields || {})
        setFormError(err.message || 'Что-то пошло не так')
      } finally {
        setSubmitting(false)
      }
    }
  }

  /** Сбрасывает форму к новым значениям (например, при редактировании другой записи). */
  function reset(nextValues = initialValues) {
    setValues(nextValues)
    setErrors({})
    setFormError(null)
  }

  return { values, setValues, errors, formError, setFormError, submitting, handleChange, handleSubmit, reset }
}
