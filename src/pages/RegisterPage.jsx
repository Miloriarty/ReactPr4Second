import { Link, useLocation } from 'react-router'
import { Alert, Field, PasswordField, PhoneField, SubmitButton } from '../components/ui.jsx'
import { useAuth } from '../context/contexts.js'
import { useForm } from '../hooks/useForm.js'
import { useTitle } from '../hooks/useTitle.js'
import { email, password, personName, phone, required, sameAs } from '../utils/validators.js'

const schema = {
  fullName: [required('Введите имя'), personName()],
  email: [required('Введите email'), email()],
  phone: [required('Введите телефон'), phone()],
  password: [required('Придумайте пароль'), password()],
  passwordConfirm: [required('Повторите пароль'), sameAs('password', 'Пароли не совпадают')],
}

/** Регистрация: ФИО, email, телефон, пароль с подтверждением. После нее пользователь сразу авторизован. */
export default function RegisterPage() {
  useTitle('Регистрация')
  const { register } = useAuth()
  const location = useLocation()
  const form = useForm({ fullName: '', email: '', phone: '', password: '', passwordConfirm: '' }, schema)
  const { values, errors } = form

  const submit = form.handleSubmit(async (v) => {
    await register({ fullName: v.fullName.trim(), email: v.email.trim(), phone: v.phone.trim(), password: v.password })
  })

  const emailTaken = form.errors.email?.includes('занят')

  return (
    <div className="auth-page">
      <form className="card auth-form" onSubmit={submit} noValidate>
        <h1>Регистрация</h1>
        {location.state?.message && <Alert type="info">{location.state.message}</Alert>}
        <Alert type="error">{form.formError}</Alert>
        {emailTaken && (
          <Alert type="warning">
            Похоже, у вас уже есть аккаунт.{' '}
            <Link to="/login" state={{ ...location.state, email: values.email }}>
              Войдите
            </Link>{' '}
            или{' '}
            <Link to="/forgot-password" state={{ email: values.email }}>
              восстановите пароль
            </Link>
            .
          </Alert>
        )}
        <Field
          label="Полное имя"
          name="fullName"
          autoComplete="name"
          required
          value={values.fullName}
          onChange={form.handleChange}
          error={errors.fullName}
          placeholder="Иванов Иван Иванович"
        />
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
        <PhoneField
          label="Телефон"
          name="phone"
          required
          value={values.phone}
          onChange={form.handleChange}
          error={errors.phone}
          hint="Российский номер, можно начинать с 8 — код страны подставится сам"
        />
        <PasswordField
          label="Пароль"
          name="password"
          autoComplete="new-password"
          required
          value={values.password}
          onChange={form.handleChange}
          error={errors.password}
          hint="Не короче 8 символов, хотя бы одна буква и одна цифра"
        />
        <PasswordField
          label="Повторите пароль"
          name="passwordConfirm"
          autoComplete="new-password"
          required
          value={values.passwordConfirm}
          onChange={form.handleChange}
          error={errors.passwordConfirm}
        />
        <SubmitButton submitting={form.submitting} busyText="Создаём аккаунт…" className="btn btn--primary btn--block">
          Зарегистрироваться
        </SubmitButton>
        <div className="auth-form__links">
          <span>
            Уже есть аккаунт?{' '}
            <Link to="/login" state={location.state}>
              Войти
            </Link>
          </span>
        </div>
      </form>
    </div>
  )
}
