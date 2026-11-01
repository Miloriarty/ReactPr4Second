import { Link, useLocation } from 'react-router'
import { Alert, Field, PasswordField, SubmitButton } from '../components/ui.jsx'
import { useAuth } from '../context/contexts.js'
import { useForm } from '../hooks/useForm.js'
import { useTitle } from '../hooks/useTitle.js'
import { email, maxLength, required } from '../utils/validators.js'

const schema = {
  email: [required('Введите email'), email()],
  password: [required('Введите пароль'), maxLength(72)],
}

/**
 * Вход по email и паролю. После успешного входа GuestOnly сам вернет пользователя
 * туда, откуда его отправили на вход (например, со страницы услуги).
 */
export default function LoginPage() {
  useTitle('Вход')
  const { login, sessionMessage } = useAuth()
  const location = useLocation()
  const form = useForm({ email: location.state?.email || '', password: '' }, schema)
  const { values, errors } = form

  const submit = form.handleSubmit(async (v) => {
    await login(v.email.trim(), v.password)
  })

  const notice = location.state?.message || sessionMessage

  return (
    <div className="auth-page">
      <form className="card auth-form" onSubmit={submit} noValidate>
        <h1>Вход</h1>
        {notice && <Alert type="info">{notice}</Alert>}
        <Alert type="error">{form.formError}</Alert>
        <Field
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          required
          value={values.email}
          onChange={form.handleChange}
          error={errors.email}
        />
        <PasswordField
          label="Пароль"
          name="password"
          autoComplete="current-password"
          required
          value={values.password}
          onChange={form.handleChange}
          error={errors.password}
        />
        <SubmitButton submitting={form.submitting} busyText="Входим…" className="btn btn--primary btn--block">
          Войти
        </SubmitButton>
        <div className="auth-form__links">
          <Link to="/forgot-password" state={{ email: values.email }}>
            Забыли пароль?
          </Link>
          <span>
            Нет аккаунта?{' '}
            <Link to="/register" state={location.state}>
              Зарегистрироваться
            </Link>
          </span>
        </div>
      </form>
    </div>
  )
}
