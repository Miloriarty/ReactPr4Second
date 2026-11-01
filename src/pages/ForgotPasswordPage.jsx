import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { api } from '../api/client.js'
import { Alert, Field, PasswordField, SubmitButton } from '../components/ui.jsx'
import { useAuth } from '../context/contexts.js'
import { useForm } from '../hooks/useForm.js'
import { useTitle } from '../hooks/useTitle.js'
import { email, password, required, sameAs } from '../utils/validators.js'

/**
 * Восстановление пароля в два шага:
 * 1) пользователь вводит email - сервер присылает письмо с 6-значным кодом (действует 15 минут);
 * 2) вводит код из письма и новый пароль - и сразу оказывается в аккаунте.
 * Повторно запросить код можно не чаще раза в минуту (таймер на кнопке).
 */
export default function ForgotPasswordPage() {
  useTitle('Восстановление пароля')
  const location = useLocation()
  const [step, setStep] = useState({ name: 'email', email: location.state?.email || '' })

  return (
    <div className="auth-page">
      <div className="card auth-form">
        <h1>Восстановление пароля</h1>
        {step.name === 'email' ? (
          <RequestCodeForm initialEmail={step.email} onSent={(sent) => setStep({ name: 'code', ...sent })} />
        ) : (
          <ResetForm
            email={step.email}
            message={step.message}
            resendIn={step.resendIn}
            onChangeEmail={() => setStep({ name: 'email', email: step.email })}
            onResent={(sent) => setStep({ name: 'code', ...sent })}
          />
        )}
        <div className="auth-form__links">
          <Link to="/login">Вспомнили пароль? Войти</Link>
        </div>
      </div>
    </div>
  )
}

/** Шаг 1: запрос кода на email. */
function RequestCodeForm({ initialEmail, onSent }) {
  const form = useForm({ email: initialEmail }, { email: [required('Введите email'), email()] })

  const submit = form.handleSubmit(async (v) => {
    const data = await api.post('/auth/forgot-password', { email: v.email.trim() })
    onSent({ email: v.email.trim(), message: data.message, resendIn: data.resendIn ?? 60 })
  })

  return (
    <form onSubmit={submit} noValidate>
      <p className="muted">Укажите email, с которым вы регистрировались, - мы пришлем код для смены пароля.</p>
      <Alert type="error">{form.formError}</Alert>
      <Field
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        required
        value={form.values.email}
        onChange={form.handleChange}
        error={form.errors.email}
      />
      <SubmitButton submitting={form.submitting} busyText="Отправляем…" className="btn btn--primary btn--block">
        Получить код
      </SubmitButton>
    </form>
  )
}

const resetSchema = {
  code: [required('Введите код из письма'), (v) =>
      (/^\d{6}$/.test(v.trim()) ? null : 'Код состоит из 6 цифр')
  ],
  newPassword: [required('Придумайте новый пароль'), password()],
  passwordConfirm: [required('Повторите пароль'), sameAs('newPassword', 'Пароли не совпадают')],
}

/** Обратный отсчет в секундах; restart(n) запускает его заново. */
function useCountdown(initial) {
  const [left, setLeft] = useState(initial)
  useEffect(() => {
    if (left <= 0) return undefined
    const id = setTimeout(() => setLeft((s) => s - 1), 1000)
    return () => clearTimeout(id)
  }, [left])
  return [left, setLeft]
}

/** Шаг 2: ввод кода из письма и нового пароля. */
function ResetForm({ email: userEmail, message, resendIn, onChangeEmail, onResent }) {
  const { applyAuth } = useAuth()
  const navigate = useNavigate()
  const form = useForm({ code: '', newPassword: '', passwordConfirm: '' }, resetSchema)
  const [resending, setResending] = useState(false)
  const [cooldown, setCooldown] = useCountdown(resendIn)

  const submit = form.handleSubmit(async (v) => {
    const data = await api.post('/auth/reset-password', {
      email: userEmail,
      code: v.code.trim(),
      newPassword: v.newPassword,
    })
    applyAuth(data)
    navigate('/account', { replace: true })
  })

  async function resend() {
    setResending(true)
    try {
      const data = await api.post('/auth/forgot-password', { email: userEmail })
      onResent({ email: userEmail, message: data.message, resendIn: data.resendIn ?? 60 })
      setCooldown(data.resendIn ?? 60)
      form.reset()
    } catch (err) {
      form.setFormError(err.message)
    } finally {
      setResending(false)
    }
  }

  return (
    <form onSubmit={submit} noValidate>
      <Alert type="success">
        {message} ({userEmail}). Если письма нет во "Входящих", проверьте папку "Спам".
      </Alert>
      <Alert type="error">{form.formError}</Alert>
      <PasswordField
        label="Код из письма"
        name="code"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        required
        value={form.values.code}
        onChange={form.handleChange}
        error={form.errors.code}
        hint="Код действует 15 минут"
      />
      <PasswordField
        label="Новый пароль"
        name="newPassword"
        autoComplete="new-password"
        required
        value={form.values.newPassword}
        onChange={form.handleChange}
        error={form.errors.newPassword}
        hint="Не короче 8 символов, хотя бы одна буква и одна цифра"
      />
      <PasswordField
        label="Повторите пароль"
        name="passwordConfirm"
        autoComplete="new-password"
        required
        value={form.values.passwordConfirm}
        onChange={form.handleChange}
        error={form.errors.passwordConfirm}
      />
      <SubmitButton submitting={form.submitting} busyText="Сохраняем…" className="btn btn--primary btn--block">
        Сменить пароль
      </SubmitButton>
      <div className="form-actions form-actions--split">
        <button
          type="button"
          className="btn btn--ghost btn--small"
          onClick={resend}
          disabled={resending || cooldown > 0}
        >
          {resending ? 'Отправляем…' : cooldown > 0 ? `Отправить ещё раз через ${cooldown} с` : 'Отправить код ещё раз'}
        </button>
        <button type="button" className="btn btn--ghost btn--small" onClick={onChangeEmail}>
          Другой email
        </button>
      </div>
    </form>
  )
}
