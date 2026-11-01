import { useState } from 'react'
import { Link } from 'react-router'
import { api } from '../../api/client.js'
import { Alert, EmptyState, ErrorMessage, Field, Loader, SubmitButton } from '../../components/ui.jsx'
import { useApi } from '../../hooks/useApi.js'
import { useForm } from '../../hooks/useForm.js'
import { useTitle } from '../../hooks/useTitle.js'
import { formatDuration, formatPrice } from '../../utils/format.js'
import { maxLength, minLength, number, required, url } from '../../utils/validators.js'
import { DeleteButton, SectionHead } from './AdminLayout.jsx'

/** Управление услугами: список (включая скрытые), создание, редактирование, удаление. */
export default function AdminServices() {
  useTitle('Админка: услуги')
  const services = useApi((signal) => api.get('/services', { all: 1 }, signal), [])
  const categories = useApi((signal) => api.get('/categories', null, signal), [])
  const cats = useApi((signal) => api.get('/cats', { all: 1 }, signal), [])
  const [editing, setEditing] = useState(null)

  const loading = services.loading || categories.loading || cats.loading
  const error = services.error || categories.error || cats.error
  const reloadAll = () => {
    services.reload()
    categories.reload()
    cats.reload()
  }

  if (loading && !services.data) return <Loader text="Загружаем услуги…" />
  if (error) return <ErrorMessage error={error} onRetry={reloadAll} />

  function handleSaved() {
    setEditing(null)
    services.reload()
  }

  return (
    <>
      <SectionHead title="Услуги" onAdd={() => setEditing({})} addText="Новая услуга" />
      {categories.data.length === 0 && (
        <Alert type="warning">
          Сначала создайте хотя бы одну <Link to="/admin/categories">категорию</Link> — без неё услугу не добавить.
        </Alert>
      )}
      {editing && (
        <ServiceForm
          key={editing.id ?? 'new'}
          service={editing}
          categories={categories.data}
          cats={cats.data}
          onSaved={handleSaved}
          onCancel={() => setEditing(null)}
        />
      )}
      {services.data.length === 0 ? (
        <EmptyState title="Услуг пока нет" />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Название</th>
                <th>Категория</th>
                <th>Длительность</th>
                <th>Цена</th>
                <th>Котики</th>
                <th>В каталоге</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {services.data.map((s) => (
                <tr key={s.id} className={s.isActive ? '' : 'is-muted'}>
                  <td>
                    <Link to={`/services/${s.id}`}>{s.title}</Link>
                  </td>
                  <td>{s.category.name}</td>
                  <td>{formatDuration(s.durationMinutes)}</td>
                  <td>{formatPrice(s.price)}</td>
                  <td>{s.cats.map((c) => c.name).join(', ') || '—'}</td>
                  <td>{s.isActive ? 'Да' : 'Скрыта'}</td>
                  <td className="table__actions">
                    <button type="button" className="btn btn--ghost btn--small" onClick={() => setEditing(s)}>
                      Изменить
                    </button>
                    <DeleteButton
                      confirmText={`Удалить услугу "${s.title}"? Она пропадёт из корзин, но останется в истории заказов. Если нужно просто убрать её из каталога — снимите галочку "Показывать в каталоге".`}
                      onDelete={async () => {
                        await api.del(`/services/${s.id}`)
                        if (editing?.id === s.id) setEditing(null)
                        services.reload()
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
  title: [required('Введите название'), minLength(3), maxLength(150)],
  categoryId: [required('Выберите категорию')],
  description: [required('Введите описание'), minLength(10), maxLength(2000)],
  durationMinutes: [required('Укажите длительность'), number({ min: 15, max: 1440, integer: true })],
  price: [required('Укажите цену'), number({ min: 0, max: 10_000_000 })],
  imageUrl: [url()],
}

/** Форма создания/редактирования услуги, включая выбор котиков-исполнителей. */
function ServiceForm({ service, categories, cats, onSaved, onCancel }) {
  const isNew = !service.id
  const form = useForm(
    {
      title: service.title || '',
      categoryId: service.category ? String(service.category.id) : '',
      description: service.description || '',
      durationMinutes: service.durationMinutes ? String(service.durationMinutes) : '60',
      price: service.price !== undefined ? String(service.price) : '',
      imageUrl: service.imageUrl || '',
      isActive: service.isActive ?? true,
      catIds: service.cats ? service.cats.map((c) => c.id) : [],
    },
    schema,
  )
  const { values, errors } = form

  function toggleCat(id) {
    const catIds = values.catIds.includes(id) ? values.catIds.filter((x) => x !== id) : [...values.catIds, id]
    form.setValues({ ...values, catIds })
  }

  const submit = form.handleSubmit(async (v) => {
    const body = {
      title: v.title.trim(),
      categoryId: Number(v.categoryId),
      description: v.description.trim(),
      durationMinutes: Number(v.durationMinutes),
      price: Number(v.price),
      imageUrl: v.imageUrl.trim(),
      isActive: v.isActive,
      catIds: v.catIds,
    }
    if (isNew) await api.post('/services', body)
    else await api.put(`/services/${service.id}`, body)
    onSaved()
  })

  return (
    <form className="card admin-form" onSubmit={submit} noValidate>
      <h3>{isNew ? 'Новая услуга' : `Редактирование: ${service.title}`}</h3>
      <Alert type="error">{form.formError}</Alert>
      <div className="form-grid">
        <Field label="Название" name="title" required value={values.title} onChange={form.handleChange} error={errors.title} />
        <Field
          as="select"
          label="Категория"
          name="categoryId"
          required
          value={values.categoryId}
          onChange={form.handleChange}
          error={errors.categoryId}
        >
          <option value="">— выберите —</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Field>
        <Field
          label="Длительность, мин"
          name="durationMinutes"
          type="number"
          min="15"
          max="1440"
          step="15"
          required
          value={values.durationMinutes}
          onChange={form.handleChange}
          error={errors.durationMinutes}
        />
        <Field
          label="Цена, ₽"
          name="price"
          type="number"
          min="0"
          step="100"
          required
          value={values.price}
          onChange={form.handleChange}
          error={errors.price}
        />
      </div>
      <Field
        as="textarea"
        rows={3}
        label="Описание"
        name="description"
        required
        value={values.description}
        onChange={form.handleChange}
        error={errors.description}
      />
      <Field
        label="Ссылка на изображение"
        name="imageUrl"
        value={values.imageUrl}
        onChange={form.handleChange}
        error={errors.imageUrl}
        placeholder="https://…"
      />
      <fieldset className="checkbox-group">
        <legend>Котики на услуге</legend>
        {cats.length === 0 && (
          <span className="muted">
            Котиков пока нет — <Link to="/admin/cats">добавьте</Link>.
          </span>
        )}
        {cats.map((cat) => (
          <label key={cat.id} className="checkbox">
            <input type="checkbox" checked={values.catIds.includes(cat.id)} onChange={() => toggleCat(cat.id)} />
            {cat.name}
            {!cat.isActive && <span className="muted"> (на отдыхе)</span>}
          </label>
        ))}
      </fieldset>
      <label className="checkbox">
        <input type="checkbox" name="isActive" checked={values.isActive} onChange={form.handleChange} />
        Показывать в каталоге
      </label>
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
