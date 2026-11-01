import { createContext, useContext } from 'react'

/*
 * Контексты приложения и хуки доступа к ним.
 * Провайдеры лежат в отдельных .jsx-файлах (AuthProvider, CartProvider, ToastProvider).
 */

export const AuthContext = createContext(null)
export const CartContext = createContext(null)
export const ToastContext = createContext(null)

/** Текущий пользователь и действия входа/выхода. */
export const useAuth = () => useContext(AuthContext)

/** Корзина текущего пользователя (хранится на сервере). */
export const useCart = () => useContext(CartContext)

/** Всплывающие уведомления: notify('Текст', 'success' | 'error' | 'info'). */
export const useToast = () => useContext(ToastContext)
