import { Route, Routes } from 'react-router'
import { GuestOnly, RequireAdmin, RequireAuth } from './components/guards.jsx'
import Layout from './components/Layout.jsx'
import AccountLayout from './pages/account/AccountLayout.jsx'
import OrdersTab from './pages/account/OrdersTab.jsx'
import PasswordTab from './pages/account/PasswordTab.jsx'
import ProfileTab from './pages/account/ProfileTab.jsx'
import AdminCategories from './pages/admin/AdminCategories.jsx'
import AdminCats from './pages/admin/AdminCats.jsx'
import AdminLayout from './pages/admin/AdminLayout.jsx'
import AdminOrders from './pages/admin/AdminOrders.jsx'
import AdminReviews from './pages/admin/AdminReviews.jsx'
import AdminServices from './pages/admin/AdminServices.jsx'
import AdminUsers from './pages/admin/AdminUsers.jsx'
import CartPage from './pages/CartPage.jsx'
import CatalogPage from './pages/CatalogPage.jsx'
import CatsPage from './pages/CatsPage.jsx'
import CheckoutPage from './pages/CheckoutPage.jsx'
import ForgotPasswordPage from './pages/ForgotPasswordPage.jsx'
import LoginPage from './pages/LoginPage.jsx'
import NotFoundPage from './pages/NotFoundPage.jsx'
import RegisterPage from './pages/RegisterPage.jsx'
import ServicePage from './pages/ServicePage.jsx'

/**
 * Карта маршрутов приложения:
 * - публичные: каталог, услуга, котики, восстановление пароля;
 * - только для гостей: вход, регистрация;
 * - для авторизованных: корзина, оформление, личный кабинет;
 * - для администратора: /admin/*.
 */
export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<CatalogPage />} />
        <Route path="services/:id" element={<ServicePage />} />
        <Route path="cats" element={<CatsPage />} />
        <Route path="forgot-password" element={<ForgotPasswordPage />} />

        <Route element={<GuestOnly />}>
          <Route path="login" element={<LoginPage />} />
          <Route path="register" element={<RegisterPage />} />
        </Route>

        <Route element={<RequireAuth />}>
          <Route path="cart" element={<CartPage />} />
          <Route path="checkout" element={<CheckoutPage />} />
          <Route path="account" element={<AccountLayout />}>
            <Route index element={<OrdersTab />} />
            <Route path="profile" element={<ProfileTab />} />
            <Route path="password" element={<PasswordTab />} />
          </Route>

          <Route element={<RequireAdmin />}>
            <Route path="admin" element={<AdminLayout />}>
              <Route index element={<AdminOrders />} />
              <Route path="services" element={<AdminServices />} />
              <Route path="categories" element={<AdminCategories />} />
              <Route path="cats" element={<AdminCats />} />
              <Route path="users" element={<AdminUsers />} />
              <Route path="reviews" element={<AdminReviews />} />
            </Route>
          </Route>
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}
