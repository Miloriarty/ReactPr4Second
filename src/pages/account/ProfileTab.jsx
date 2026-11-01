import { api } from '../../api/client.js'
import { Alert, Field, PhoneField, SubmitButton } from '../../components/ui.jsx'
import { useAuth } from '../../context/contexts.js'
import { useForm } from '../../hooks/useForm.js'
import { useTitle } from '../../hooks/useTitle.js'
import { formatPhoneInput } from '../../utils/format.js'
import { address, email, personName, phone, required } from '../../utils/validators.js'

const schema = {
  fullName: [required('Введите имя'), personName()],
  email: [required('Введите email'), email()],
  phone: [required('Введите телефон'), phone()],
  defaultAddress: [address()],
}

/** Редактирование личных данных: ФИО, email, телефон, адрес по умолчанию. */
export default function ProfileTab() {
  useTitle('Личные данные')
  const { user, setUser } = useAuth()
  const initial = {
    fullName: user.fullName,
    email: user.email,
    phone: formatPhoneInput(user.phone),
    defaultAddress: user.defaultAddress || '',
  }
  const form = useForm(initial, schema)
  const { values, errors } = form

  const changed = Object.keys(initial).some((key) => values[key].trim() !== initial[key])

  const submit = form.handleSubmit(async (v) => {
    const data = await api.put('/profile', {
      fullName: v.fullName.trim(),
      email: v.email.trim(),
      phone: v.phone.trim(),
      defaultAddress: v.defaultAddress.trim(),
    })
    setUser(data.user)
    form.reset({ ...data.user, phone: formatPhoneInput(data.user.phone), defaultAddress: data.user.defaultAddress || '' })
  })

  return (
    <form className="card form-narrow" onSubmit={submit} noValidate>
      <Alert type="error">{form.formError}</Alert>
      <Field
        label="Полное имя"
        name="fullName"
        required
        autoComplete="name"
        value={values.fullName}
        onChange={form.handleChange}
        error={errors.fullName}
      />
      <Field
        label="Email"
        name="email"
        type="email"
        required
        autoComplete="email"
        value={values.email}
        onChange={form.handleChange}
        error={errors.email}
        hint="Используется для входа"
      />
      <PhoneField
        label="Телефон"
        name="phone"
        required
        value={values.phone}
        onChange={form.handleChange}
        error={errors.phone}
      />
      <Field
        as="textarea"
        rows={2}
        label="Адрес по умолчанию"
        name="defaultAddress"
        autoComplete="street-address"
        value={values.defaultAddress}
        onChange={form.handleChange}
        error={errors.defaultAddress}
        hint="Подставляется при оформлении заказа"
      />
      <div className="form-actions">
        <SubmitButton submitting={form.submitting} busyText="Сохраняем…">
          Сохранить
        </SubmitButton>
        {changed && (
          <button type="button" className="btn btn--ghost" onClick={() => form.reset(initial)}>
            Отменить изменения
          </button>
        )}
      </div>
    </form>
  )
}
