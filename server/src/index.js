import { createApp } from './app.js'
import { config } from './config.js'
import { verifyMail } from './mail.js'

createApp().listen(config.port, () => {
  console.log(`API запущен: http://localhost:${config.port}/api`)
  verifyMail()
})
