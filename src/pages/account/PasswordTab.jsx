import { Link } from 'react-router'
import { api } from '../../api/client.js'
import { Alert, PasswordField, SubmitButton } from '../../components/ui.jsx'
import { useAuth } from '../../context/contexts.js'
import { useForm } from '../../hooks/useForm.js'
import { useTitle } from '../../hooks/useTitle.js'
import { password, required, sameAs } from '../../utils/validators.js'

const EMPTY = { currentPassword: '', newPassword: '', passwordConfirm: '' }

const schema = {
  currentPassword: [required('Введите текущий пароль')],
  newPassword: [
    required('Придумайте новый пароль'),
    password(),
    (v, values) => (v && v === values.currentPassword ? 'Новый пароль совпадает с текущим' : null),
  ],
  passwordConfirm: [required('Повторите новый пароль'), sameAs('newPassword', 'Пароли не совпадают')],
}

/**
 * Смена пароля. Сервер возвращает новый токен: эта сессия продолжает работать,
 * а на остальных устройствах придется войти заново.
 */
export default function PasswordTab() {
  useTitle('Смена пароля')
  const { user, setToken } = useAuth()
  const form = useForm(EMPTY, schema)
  const { values, errors } = form

  const submit = form.handleSubmit(async (v) => {
    const data = await api.put('/profile/password', {
      currentPassword: v.currentPassword,
      newPassword: v.newPassword,
    })
    setToken(data.token)
    form.reset(EMPTY)
  })

  return (
    <form className="card form-narrow" onSubmit={submit} noValidate>
      <Alert type="error">{form.formError}</Alert>
      <PasswordField
        label="Текущий пароль"
        name="currentPassword"
        required
        autoComplete="current-password"
        value={values.currentPassword}
        onChange={form.handleChange}
        error={errors.currentPassword}
      />
      <PasswordField
        label="Новый пароль"
        name="newPassword"
        required
        autoComplete="new-password"
        value={values.newPassword}
        onChange={form.handleChange}
        error={errors.newPassword}
        hint="Не короче 8 символов, хотя бы одна буква и одна цифра"
      />
      <PasswordField
        label="Повторите новый пароль"
        name="passwordConfirm"
        required
        autoComplete="new-password"
        value={values.passwordConfirm}
        onChange={form.handleChange}
        error={errors.passwordConfirm}
      />
      <div className="form-actions form-actions--split">
        <SubmitButton submitting={form.submitting} busyText="Сохраняем…">
          Сменить пароль
        </SubmitButton>
        <Link to="/forgot-password" state={{ email: user.email }}>
          Не помню текущий пароль
        </Link>
      </div>
    </form>
  )
}
