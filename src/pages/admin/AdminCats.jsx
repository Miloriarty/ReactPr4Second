import { useState } from 'react'
import { api } from '../../api/client.js'
import CatAvatar from '../../components/CatAvatar.jsx'
import { Alert, EmptyState, ErrorMessage, Field, Loader, SubmitButton } from '../../components/ui.jsx'
import { useApi } from '../../hooks/useApi.js'
import { useForm } from '../../hooks/useForm.js'
import { useTitle } from '../../hooks/useTitle.js'
import { maxLength, minLength, number, personName, required, url } from '../../utils/validators.js'
import { DeleteButton, SectionHead } from './AdminLayout.jsx'

/** Управление "сотрудниками"-котиками: фото, порода, возраст, описание, активность. */
export default function AdminCats() {
  useTitle('Админка: котики')
  const cats = useApi((signal) => api.get('/cats', { all: 1 }, signal), [])
  const [editing, setEditing] = useState(null)

  if (cats.loading && !cats.data) return <Loader text="Загружаем котиков…" />
  if (cats.error) return <ErrorMessage error={cats.error} onRetry={cats.reload} />

  return (
    <>
      <SectionHead title="Котики" onAdd={() => setEditing({})} addText="Новый котик" />
      {editing && (
        <CatForm
          key={editing.id ?? 'new'}
          cat={editing}
          onSaved={() => {
            setEditing(null)
            cats.reload()
          }}
          onCancel={() => setEditing(null)}
        />
      )}
      {cats.data.length === 0 ? (
        <EmptyState title="Котиков пока нет" />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Фото</th>
                <th>Имя</th>
                <th>Порода</th>
                <th>Возраст</th>
                <th>Услуги</th>
                <th>Статус</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {cats.data.map((cat) => (
                <tr key={cat.id} className={cat.isActive ? '' : 'is-muted'}>
                  <td>
                    <CatAvatar cat={cat} size="small" />
                  </td>
                  <td>{cat.name}</td>
                  <td>{cat.breed || '—'}</td>
                  <td>{cat.ageYears ?? '—'}</td>
                  <td>{cat.services.map((s) => s.title).join(', ') || '—'}</td>
                  <td>{cat.isActive ? 'Работает' : 'На отдыхе'}</td>
                  <td className="table__actions">
                    <button type="button" className="btn btn--ghost btn--small" onClick={() => setEditing(cat)}>
                      Изменить
                    </button>
                    <DeleteButton
                      confirmText={`Удалить котика "${cat.name}"? Он будет снят со всех услуг.`}
                      onDelete={async () => {
                        await api.del(`/cats/${cat.id}`)
                        cats.reload()
                      }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}

const schema = {
  name: [required('Введите имя'), personName(), maxLength(50)],
  breed: [minLength(2), maxLength(100)],
  ageYears: [number({ min: 0, max: 30, integer: true })],
  photoUrl: [url()],
  description: [maxLength(1000)],
}

function CatForm({ cat, onSaved, onCancel }) {
  const isNew = !cat.id
  const form = useForm(
    {
      name: cat.name || '',
      breed: cat.breed || '',
      ageYears: cat.ageYears ?? '',
      photoUrl: cat.photoUrl || '',
      description: cat.description || '',
      isActive: cat.isActive ?? true,
    },
    schema,
  )
  const { values, errors } = form

  const submit = form.handleSubmit(async (v) => {
    const body = {
      name: v.name.trim(),
      breed: v.breed.trim(),
      ageYears: v.ageYears === '' ? null : Number(v.ageYears),
      photoUrl: v.photoUrl.trim(),
      description: v.description.trim(),
      isActive: v.isActive,
    }
    if (isNew) await api.post('/cats', body)
    else await api.put(`/cats/${cat.id}`, body)
    onSaved()
  })

  return (
    <form className="card admin-form" onSubmit={submit} noValidate>
      <h3>{isNew ? 'Новый котик' : `Редактирование: ${cat.name}`}</h3>
      <Alert type="error">{form.formError}</Alert>
      <div className="form-grid">
        <Field label="Имя" name="name" required value={values.name} onChange={form.handleChange} error={errors.name} />
        <Field label="Порода" name="breed" value={values.breed} onChange={form.handleChange} error={errors.breed} />
        <Field
          label="Возраст, лет"
          name="ageYears"
          type="number"
          min="0"
          max="30"
          value={values.ageYears}
          onChange={form.handleChange}
          error={errors.ageYears}
        />
      </div>
      <div className="photo-field">
        <Field
          label="Ссылка на фото"
          name="photoUrl"
          value={values.photoUrl}
          onChange={form.handleChange}
          error={errors.photoUrl}
          placeholder="https://…"
        />
        {values.photoUrl && !errors.photoUrl && (
          <CatAvatar key={values.photoUrl} cat={{ name: values.name || '?', photoUrl: values.photoUrl }} size="large" />
        )}
      </div>
      <Field
        as="textarea"
        rows={3}
        label="Описание"
        name="description"
        value={values.description}
        onChange={form.handleChange}
        error={errors.description}
      />
      <label className="checkbox">
        <input type="checkbox" name="isActive" checked={values.isActive} onChange={form.handleChange} />
        Работает (показывать на сайте)
      </label>
      <div className="form-actions">
        <SubmitButton submitting={form.submitting} busyText="Сохраняем…">
          {isNew ? 'Добавить' : 'Сохранить'}
        </SubmitButton>
        <button type="button" className="btn btn--ghost" onClick={onCancel}>
          Отмена
        </button>
      </div>
    </form>
  )
}
