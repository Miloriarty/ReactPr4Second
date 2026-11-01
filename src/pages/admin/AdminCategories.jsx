import { useState } from 'react'
import { api } from '../../api/client.js'
import { Alert, EmptyState, ErrorMessage, Field, Loader, SubmitButton } from '../../components/ui.jsx'
import { useApi } from '../../hooks/useApi.js'
import { useForm } from '../../hooks/useForm.js'
import { useTitle } from '../../hooks/useTitle.js'
import { maxLength, minLength, required } from '../../utils/validators.js'
import { DeleteButton, SectionHead } from './AdminLayout.jsx'

/** Управление категориями услуг. Категорию с услугами удалить нельзя - сервер вернет пояснение. */
export default function AdminCategories() {
  useTitle('Админка: категории')
  const categories = useApi((signal) => api.get('/categories', null, signal), [])
  const [editing, setEditing] = useState(null)

  if (categories.loading && !categories.data) return <Loader text="Загружаем категории…" />
  if (categories.error) return <ErrorMessage error={categories.error} onRetry={categories.reload} />

  return (
    <>
      <SectionHead title="Категории" onAdd={() => setEditing({})} addText="Новая категория" />
      {editing && (
        <CategoryForm
          key={editing.id ?? 'new'}
          category={editing}
          onSaved={() => {
            setEditing(null)
            categories.reload()
          }}
          onCancel={() => setEditing(null)}
        />
      )}
      {categories.data.length === 0 ? (
        <EmptyState title="Категорий пока нет" />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Название</th>
                <th>Описание</th>
                <th>Активных услуг</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {categories.data.map((c) => (
                <tr key={c.id}>
                  <td>{c.name}</td>
                  <td>{c.description || '—'}</td>
                  <td>{c.servicesCount}</td>
                  <td className="table__actions">
                    <button type="button" className="btn btn--ghost btn--small" onClick={() => setEditing(c)}>
                      Изменить
                    </button>
                    <DeleteButton
                      confirmText={`Удалить категорию "${c.name}"?`}
                      onDelete={async () => {
                        await api.del(`/categories/${c.id}`)
                        categories.reload()
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
  name: [required('Введите название'), minLength(2), maxLength(100)],
  description: [maxLength(500)],
}

function CategoryForm({ category, onSaved, onCancel }) {
  const isNew = !category.id
  const form = useForm({ name: category.name || '', description: category.description || '' }, schema)

  const submit = form.handleSubmit(async (v) => {
    const body = { name: v.name.trim(), description: v.description.trim() }
    if (isNew) await api.post('/categories', body)
    else await api.put(`/categories/${category.id}`, body)
    onSaved()
  })

  return (
    <form className="card admin-form" onSubmit={submit} noValidate>
      <h3>{isNew ? 'Новая категория' : `Редактирование: ${category.name}`}</h3>
      <Alert type="error">{form.formError}</Alert>
      <Field label="Название" name="name" required value={form.values.name} onChange={form.handleChange} error={form.errors.name} />
      <Field
        as="textarea"
        rows={2}
        label="Описание"
        name="description"
        value={form.values.description}
        onChange={form.handleChange}
        error={form.errors.description}
      />
      <div className="form-actions">
        <SubmitButton submitting={form.submitting} busyText="Сохраняем…">
          {isNew ? 'Создать' : 'Сохранить'}
        </SubmitButton>
        <button type="button" className="btn btn--ghost" onClick={onCancel}>
          Отмена
        </button>
      </div>
    </form>
  )
}
