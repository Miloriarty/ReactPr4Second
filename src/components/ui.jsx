/* Мелкие переиспользуемые элементы интерфейса. */
import { useState } from 'react'
import { formatPhoneInput } from '../utils/format.js'

/** Индикатор загрузки. */
export function Loader({ text = 'Загрузка…', inline = false }) {
  return (
    <div className={inline ? 'loader loader--inline' : 'loader'} role="status">
      <span className="loader__spinner" aria-hidden="true" />
      <span>{text}</span>
    </div>
  )
}

/** Сообщение об ошибке запроса с кнопкой "Повторить". */
export function ErrorMessage({ error, onRetry, title = 'Не удалось загрузить данные' }) {
  if (!error) return null
  return (
    <div className="alert alert--error" role="alert">
      <strong>{title}</strong>
      <span>{error.message || String(error)}</span>
      {onRetry && (
        <button type="button" className="btn btn--small" onClick={onRetry}>
          Повторить
        </button>
      )}
    </div>
  )
}

/** Цветная плашка с текстом: success | error | info | warning. */
export function Alert({ type = 'info', children }) {
  if (!children) return null
  return (
    <div className={`alert alert--${type}`} role={type === 'error' ? 'alert' : 'status'}>
      {children}
    </div>
  )
}

/** Пустое состояние списка с подсказкой, что делать дальше. */
export function EmptyState({ title, children }) {
  return (
    <div className="empty">
      <div className="empty__icon" aria-hidden="true">🐾</div>
      <h3>{title}</h3>
      {children}
    </div>
  )
}

/**
 * Поле формы с подписью и текстом ошибки.
 * as = 'input' | 'textarea' | 'select'; остальные props уходят в сам элемент.
 * Браузерная валидация у форм отключена (noValidate)
 */
export function Field({ label, name, error, hint, as: Tag = 'input', suffix, children, ...props }) {
  const id = `field-${name}`
  const control = (
    <Tag id={id} name={name}
         aria-invalid={Boolean(error)}
         aria-describedby={error ? `${id}-error` : undefined} {...props}
    >
      {children}
    </Tag>
  )
  return (
    <div className={`field${error ? ' field--error' : ''}`}>
      <label htmlFor={id}>
        {label}
        {props.required && <span className="field__req"> *</span>}
      </label>
      {/* suffix - кнопка внутри поля справа (например, "показать пароль") */}
      {suffix ? (
        <div className="field__control">
          {control}
          {suffix}
        </div>
      ) : (
        control
      )}
      {error ? (
        <span id={`${id}-error`} className="field__error">
          {error}
        </span>
      ) : (
        hint && <span className="field__hint">{hint}</span>
      )}
    </div>
  )
}

/**
 * Поле пароля с кнопкой-глазком "Показать / скрыть пароль".
 * Принимает те же props, что и Field (кроме type).
 */
export function PasswordField(props) {
  const [visible, setVisible] = useState(false)
  const toggle = (
    <button
      type="button"
      className="field__toggle"
      onClick={() => setVisible((v) => !v)}
      aria-label={visible ? 'Скрыть пароль' : 'Показать пароль'}
      aria-pressed={visible}
      aria-controls={`field-${props.name}`}
      title={visible ? 'Скрыть пароль' : 'Показать пароль'}
    >
      {visible ? <EyeOffIcon /> : <EyeIcon />}
    </button>
  )
  return <Field {...props} type={visible ? 'text' : 'password'} suffix={toggle} />
}

function EyeIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

function EyeOffIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 19c-6.5 0-10-7-10-7a18.5 18.5 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c6.5 0 10 7 10 7a18.5 18.5 0 0 1-2.16 3.19" />
      <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
      <line x1="2" y1="2" x2="22" y2="22" />
    </svg>
  )
}

/**
 * Поле телефона с маской "+7 (900) 123-45-67": форматирует ввод на лету
 * и отдает в onChange обычное событие с уже отформатированным значением.
 */
export function PhoneField({ onChange, ...props }) {
  function handleChange(event) {
    const { name, value } = event.target
    onChange({ target: { name, value: formatPhoneInput(value), type: 'tel' } })
  }
  return (
    <Field
      type="tel"
      inputMode="tel"
      autoComplete="tel"
      placeholder="+7 (900) 123-45-67"
      maxLength={20}
      {...props}
      onChange={handleChange}
    />
  )
}

/** Кнопка отправки формы, блокируется на время запроса. */
export function SubmitButton({ submitting, children, busyText = 'Отправка…', className = 'btn btn--primary' }) {
  return (
    <button type="submit" className={className} disabled={submitting}>
      {submitting ? busyText : children}
    </button>
  )
}

/** Рейтинг звездами (только отображение). */
export function Stars({ value, count }) {
  const rounded = Math.round(value)
  return (
    <span className="stars" title={`Оценка ${value} из 5`}>
      <span aria-hidden="true">
        {'★'.repeat(rounded)}
        <span className="stars__empty">{'★'.repeat(5 - rounded)}</span>
      </span>
      <span className="stars__value">{value > 0 ? value.toFixed(1) : 'нет оценок'}</span>
      {count !== undefined && count > 0 && <span className="muted"> ({count})</span>}
    </span>
  )
}

/** Выбор оценки 1-5 звездами для формы отзыва. */
export function StarInput({ value, onChange, error }) {
  return (
    <div className={`field${error ? ' field--error' : ''}`}>
      <span className="field__label">
        Оценка<span className="field__req"> *</span>
      </span>
      <div className="star-input" role="radiogroup" aria-label="Оценка">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={`${n} из 5`}
            className={n <= value ? 'is-on' : ''}
            onClick={() => onChange(n)}
          >
            ★
          </button>
        ))}
      </div>
      {error && <span className="field__error">{error}</span>}
    </div>
  )
}

/** Бейдж статуса заказа. */
export function StatusBadge({ status }) {
  return <span className={`badge badge--${status.code}`}>{status.name}</span>
}
