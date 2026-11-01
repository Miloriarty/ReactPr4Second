import { useState } from 'react'
import { useSearchParams } from 'react-router'
import { api } from '../api/client.js'
import ServiceCard from '../components/ServiceCard.jsx'
import { EmptyState, ErrorMessage, Loader } from '../components/ui.jsx'
import { useApi } from '../hooks/useApi.js'
import { useTitle } from '../hooks/useTitle.js'
import { plural } from '../utils/format.js'

const SORT_OPTIONS = [
  ['title', 'По названию'],
  ['price_asc', 'Сначала дешевле'],
  ['price_desc', 'Сначала дороже'],
  ['duration', 'По длительности'],
  ['rating', 'По рейтингу'],
]

/**
 * Каталог услуг с фильтрами по категории, цене, поиску и сортировкой.
 * Фильтры хранятся в адресной строке (?category=office&maxPrice=5000),
 * поэтому работают кнопки "Назад" и ссылкой на подборку можно поделиться.
 */
export default function CatalogPage() {
  useTitle('Услуги')
  const [searchParams, setSearchParams] = useSearchParams()
  const filters = {
    category: searchParams.get('category') || '',
    search: searchParams.get('search') || '',
    minPrice: searchParams.get('minPrice') || '',
    maxPrice: searchParams.get('maxPrice') || '',
    sort: searchParams.get('sort') || 'title',
  }

  const categories = useApi((signal) => api.get('/categories', null, signal), [])
  const services = useApi(
    (signal) => api.get('/services', filters, signal),
    [filters.category, filters.search, filters.minPrice, filters.maxPrice, filters.sort],
  )

  /** Меняет один или несколько фильтров в URL; пустые значения убираются. */
  function updateFilters(patch) {
    const next = { ...filters, ...patch }
    const params = {}
    for (const [key, value] of Object.entries(next)) {
      if (value && !(key === 'sort' && value === 'title')) params[key] = value
    }
    setSearchParams(params)
  }

  const hasFilters = filters.category || filters.search || filters.minPrice || filters.maxPrice

  return (
    <>
      <section className="hero">
        <h1>Котики-терапевты на выезд</h1>
        <p>
          Куратор привезёт спокойных, привитых и обученных котиков к вам в офис или домой. Минус стресс, плюс мурчание.
        </p>
      </section>

      <div className="catalog">
        <aside className="filters card">
          <h2 className="filters__title">Фильтры</h2>
          {categories.loading ? (
            <Loader inline text="Загружаем категории…" />
          ) : categories.error ? (
            <ErrorMessage error={categories.error} onRetry={categories.reload} title="Категории не загрузились" />
          ) : (
            <div className="category-list" role="group" aria-label="Категории">
              <button
                type="button"
                className={!filters.category ? 'is-active' : ''}
                onClick={() => updateFilters({ category: '' })}
              >
                Все услуги
              </button>
              {categories.data.map((c) => (
                <button
                  key={c.slug}
                  type="button"
                  className={filters.category === c.slug ? 'is-active' : ''}
                  onClick={() => updateFilters({ category: c.slug })}
                  title={c.description || undefined}
                >
                  {c.name} <span className="muted">{c.servicesCount}</span>
                </button>
              ))}
            </div>
          )}
          <FilterForm
            // key сбрасывает поля формы, когда фильтры меняются извне (кнопка "Назад", "Сбросить")
            key={`${filters.search}|${filters.minPrice}|${filters.maxPrice}`}
            filters={filters}
            onApply={updateFilters}
          />
          {hasFilters && (
            <button type="button" className="btn btn--ghost btn--block" onClick={() => setSearchParams({})}>
              Сбросить фильтры
            </button>
          )}
        </aside>

        <section className="catalog__list">
          <div className="catalog__toolbar">
            <span className="muted">
              {services.data &&
                `Найдено ${services.data.length} ${plural(services.data.length, ['услуга', 'услуги', 'услуг'])}`}
            </span>
            <label className="sort">
              Сортировка:{' '}
              <select value={filters.sort} onChange={(e) => updateFilters({ sort: e.target.value })}>
                {SORT_OPTIONS.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {services.loading ? (
            <Loader text="Загружаем услуги…" />
          ) : services.error ? (
            <ErrorMessage error={services.error} onRetry={services.reload} />
          ) : services.data.length === 0 ? (
            <EmptyState title="Ничего не нашлось">
              <p>Попробуйте изменить условия поиска.</p>
              {hasFilters && (
                <button type="button" className="btn btn--primary" onClick={() => setSearchParams({})}>
                  Показать все услуги
                </button>
              )}
            </EmptyState>
          ) : (
            <div className="grid">
              {services.data.map((service) => (
                <ServiceCard key={service.id} service={service} />
              ))}
            </div>
          )}
        </section>
      </div>
    </>
  )
}

/** Форма поиска и диапазона цен. Применяется по кнопке, чтобы не дергать API на каждую букву. */
function FilterForm({ filters, onApply }) {
  const [values, setValues] = useState({
    search: filters.search,
    minPrice: filters.minPrice,
    maxPrice: filters.maxPrice,
  })
  const [error, setError] = useState(null)

  const change = (e) => setValues((v) => ({ ...v, [e.target.name]: e.target.value }))

  function handleSubmit(e) {
    e.preventDefault()
    const min = values.minPrice === '' ? null : Number(values.minPrice)
    const max = values.maxPrice === '' ? null : Number(values.maxPrice)
    if ((min !== null && (!Number.isFinite(min) || min < 0)) || (max !== null && (!Number.isFinite(max) || max < 0))) {
      setError('Цена должна быть неотрицательным числом')
      return
    }
    if (min !== null && max !== null && min > max) {
      setError('Минимальная цена больше максимальной')
      return
    }
    if (values.search.trim().length > 100) {
      setError('Слишком длинный поисковый запрос')
      return
    }
    setError(null)
    onApply({ search: values.search.trim(), minPrice: values.minPrice, maxPrice: values.maxPrice })
  }

  return (
    <form className="filters__form" onSubmit={handleSubmit} noValidate>
      <label>
        Поиск по названию
        <input name="search" type="search" value={values.search} onChange={change} placeholder="Например, офис" />
      </label>
      <div className="price-range">
        <label>
          Цена от, ₽
          <input name="minPrice" type="number" min="0" step="100" value={values.minPrice} onChange={change} />
        </label>
        <label>
          до, ₽
          <input name="maxPrice" type="number" min="0" step="100" value={values.maxPrice} onChange={change} />
        </label>
      </div>
      {error && <span className="field__error">{error}</span>}
      <button type="submit" className="btn btn--primary btn--block">
        Применить
      </button>
    </form>
  )
}
