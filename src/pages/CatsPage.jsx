import { Link } from 'react-router'
import { api } from '../api/client.js'
import CatAvatar from '../components/CatAvatar.jsx'
import { EmptyState, ErrorMessage, Loader } from '../components/ui.jsx'
import { useApi } from '../hooks/useApi.js'
import { useTitle } from '../hooks/useTitle.js'
import { plural } from '../utils/format.js'

/** "Наши котики" - команда котиков-терапевтов и услуги, на которых они работают. */
export default function CatsPage() {
  useTitle('Наши котики')
  const cats = useApi((signal) => api.get('/cats', null, signal), [])

  return (
    <>
      <h1>Наши котики</h1>
      <p className="lead">Каждый котик привит, обучен и привык к поездкам. Куратор всегда рядом.</p>
      {cats.loading ? (
        <Loader text="Зовём котиков…" />
      ) : cats.error ? (
        <ErrorMessage error={cats.error} onRetry={cats.reload} />
      ) : cats.data.length === 0 ? (
        <EmptyState title="Котики отдыхают">
          <p>Скоро здесь появится наша команда.</p>
        </EmptyState>
      ) : (
        <div className="grid">
          {cats.data.map((cat) => (
            <article key={cat.id} className="card cat-card">
              <CatAvatar cat={cat} size="large" />
              <h3>{cat.name}</h3>
              <p className="muted">
                {[cat.breed, cat.ageYears !== null && `${cat.ageYears} ${plural(cat.ageYears, ['год', 'года', 'лет'])}`]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
              {cat.description && <p>{cat.description}</p>}
              {cat.services.length > 0 && (
                <div className="cat-card__services">
                  <span className="muted small">Работает на услугах:</span>
                  {cat.services.map((s) => (
                    <Link key={s.id} to={`/services/${s.id}`} className="chip chip--link">
                      {s.title}
                    </Link>
                  ))}
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </>
  )
}
