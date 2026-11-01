import { useState } from 'react'

/**
 * Фото котика поверх заглушки с первой буквой имени: пока фото грузится
 * или если ссылка битая, видна буква.
 */
export default function CatAvatar({ cat, size = 'medium' }) {
  const [broken, setBroken] = useState(false)
  const showPhoto = Boolean(cat.photoUrl) && !broken

  return (
    <span className={`avatar avatar--${size}`} title={cat.name}>
      <span aria-hidden={showPhoto}>{cat.name[0]}</span>
      {showPhoto && <img
          src={cat.photoUrl}
          alt={cat.name}
          loading="lazy"
          onError={() => setBroken(true)} />}
    </span>
  )
}
