import { useState } from 'react'
import { api } from '../../api/client.js'
import { Alert, ErrorMessage, Field, Loader, PhoneField, SubmitButton } from '../../components/ui.jsx'
import { useAuth } from '../../context/contexts.js'
import { useApi } from '../../hooks/useApi.js'
import { useForm } from '../../hooks/useForm.js'
import { useTitle } from '../../hooks/useTitle.js'
import { formatDateTime, formatPhoneInput } from '../../utils/format.js'
import { address, email, personName, phone, required } from '../../utils/validators.js'
import { DeleteButton, SectionHead } from './AdminLayout.jsx'

/**
 * Пользователи: просмотр, редактирование контактов, удаление.
 * Роли администратор не меняет; себя и других администраторов удалить нельзя.
 */
export default function AdminUsers() {
  useTitle('Админка: пользователи')
  const { user: me } = useAuth()
  const users = useApi((signal) => api.get('/admin/users', null, signal), [])
  const [editing, setEditing] = useState(null)

  if (users.loading && !users.data) return <Loader text="Загружаем пользователей…" />
  if (users.error) return <ErrorMessage error={users.error} onRetry={users.reload} />

  return (
    <>
      <SectionHead title="Пользователи" />
      {editing && (
        <UserForm
          key={editing.id}
          user={editing}
          onSaved={() => {
            setEditing(null)
            users.reload()
          }}
          onCancel={() => setEditing(null)}
        />
      )}
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Имя</th>
              <th>Email</th>
              <th>Телефон</th>
              <th>Роль</th>
              <th>Заказов</th>
              <th>Регистрация</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {users.data.map((u) => {
              const protectedUser = u.role === 'admin'
              return (
                <tr key={u.id}>
                  <td>
                    {u.fullName}
                    {u.id === me.id && <span className="muted"> (вы)</span>}
                  </td>
                  <td>{u.email}</td>
                  <td>{u.phone}</td>
                  <td>{u.roleName}</td>
                  <td>{u.ordersCount}</td>
                  <td>{formatDateTime(u.createdAt)}</td>
                  <td className="table__actions">
                    <button type="button" className="btn btn--ghost btn--small" onClick={() => setEditing(u)}>
                      Изменить
                    </button>
                    <DeleteButton
                      disabled={protectedUser}
                      title={protectedUser ? 'Администратора удалить нельзя' : undefined}
                      confirmText={`Удалить пользователя ${u.fullName}? Вместе с ним удалятся его заказы, отзывы и корзина.`}
                      onDelete={async () => {
                        await api.del(`/admin/users/${u.id}`)
                        users.reload()
                      }}
                    />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </>
  )
}

const schema = {
  fullName: [required('Введите имя'), personName()],
  email: [required('Введите email'), email()],
  phone: [required('Введите телефон'), phone()],
  defaultAddress: [address()],
}

function UserForm({ user, onSaved, onCancel }) {
  const { user: me, setUser } = useAuth()
  const form = useForm(
    { fullName: user.fullName, email: user.email, phone: formatPhoneInput(user.phone), defaultAddress: user.defaultAddress || '' },
    schema,
  )
  const { values, errors } = form

  const submit = form.handleSubmit(async (v) => {
    const updated = await api.put(`/admin/users/${user.id}`, {
      fullName: v.fullName.trim(),
      email: v.email.trim(),
      phone: v.phone.trim(),
      defaultAddress: v.defaultAddress.trim(),
    })
    if (updated.id === me.id) setUser(updated)
    onSaved()
  })

  return (
    <form className="card admin-form" onSubmit={submit} noValidate>
      <h3>Редактирование: {user.fullName}</h3>
      <Alert type="error">{form.formError}</Alert>
      <div className="form-grid">
        <Field label="Полное имя" name="fullName" required value={values.fullName} onChange={form.handleChange} error={errors.fullName} />
        <Field label="Email" name="email" type="email" required value={values.email} onChange={form.handleChange} error={errors.email} />
        <PhoneField label="Телефон" name="phone" required value={values.phone} onChange={form.handleChange} error={errors.phone} />
      </div>
      <Field
        as="textarea"
        rows={2}
        label="Адрес по умолчанию"
        name="defaultAddress"
        value={values.defaultAddress}
        onChange={form.handleChange}
        error={errors.defaultAddress}
      />
      <p className="muted small">Роль пользователя: {user.roleName} (роли не редактируются)</p>
      <div className="form-actions">
        <SubmitButton submitting={form.submitting} busyText="Сохраняем…">
          Сохранить
        </SubmitButton>
        <button type="button" className="btn btn--ghost" onClick={onCancel}>
          Отмена
        </button>
      </div>
    </form>
  )
}
