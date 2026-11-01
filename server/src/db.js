import pg from 'pg'
import { config } from './config.js'

// NUMERIC приходит из pg строкой - превращаем в число, чтобы фронтенд получал цены как number
pg.types.setTypeParser(pg.types.builtins.NUMERIC, (value) => Number(value))
// DATE отдаем как 'YYYY-MM-DD' без сдвига часового пояса
pg.types.setTypeParser(pg.types.builtins.DATE, (value) => value)

export const pool = new pg.Pool({ connectionString: config.databaseUrl })

/** Выполняет один SQL-запрос с параметрами. */
export function query(text, params) {
  return pool.query(text, params)
}

/**
 * Выполняет функцию в транзакции: COMMIT при успехе, ROLLBACK при ошибке.
 * В callback передается клиент, через который нужно делать все запросы транзакции.
 */
export async function withTransaction(callback) {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const result = await callback(client)
    await client.query('COMMIT')
    return result
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}
