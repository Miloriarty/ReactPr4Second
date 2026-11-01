import cors from 'cors'
import express from 'express'
import { config } from './config.js'
import { query } from './db.js'
import { errorHandler, notFoundHandler } from './middleware/errors.js'
import adminRouter from './routes/admin.js'
import authRouter from './routes/auth.js'
import cartRouter from './routes/cart.js'
import catsRouter from './routes/cats.js'
import categoriesRouter from './routes/categories.js'
import ordersRouter from './routes/orders.js'
import profileRouter from './routes/profile.js'
import reviewsRouter from './routes/reviews.js'
import servicesRouter from './routes/services.js'

/**
 * Собирает Express-приложение. Express 5 сам передает ошибки async-обработчиков
 * в errorHandler, поэтому try/catch в маршрутах не нужен.
 */
export function createApp() {
  const app = express()

  app.use(cors({ origin: config.clientOrigin }))
  app.use(express.json({ limit: '100kb' }))

  /** GET /api/health - проверка, что сервер и БД живы. */
  app.get('/api/health', async (req, res) => {
    await query('SELECT 1')
    res.json({ status: 'ok' })
  })

  app.use('/api/auth', authRouter)
  app.use('/api/profile', profileRouter)
  app.use('/api/categories', categoriesRouter)
  app.use('/api/services', servicesRouter)
  app.use('/api/cats', catsRouter)
  app.use('/api/cart', cartRouter)
  app.use('/api/admin', adminRouter)
  app.use('/api', reviewsRouter)
  app.use('/api', ordersRouter)

  app.use('/api', notFoundHandler)
  app.use(errorHandler)
  return app
}
