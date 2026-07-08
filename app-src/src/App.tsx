import { Routes, Route, Navigate } from 'react-router-dom'
import Login from './shell/Login'
import RequireAuth from './shell/RequireAuth'
import RequirePermission from './shell/RequirePermission'
import Layout from './shell/Layout'
import Launcher from './shell/Launcher'
import UsersAdmin from './modules/users/UsersAdmin'
import FinanceModule from './modules/finance/FinanceModule'
import QuotesModule from './modules/quotes/QuotesModule'
import QuotePage from './modules/quotes/QuotePage'
import { PERM } from './lib/permissions'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      {/* Everything below requires a session */}
      <Route element={<RequireAuth />}>
        <Route element={<Layout />}>
          <Route index element={<Launcher />} />
          <Route
            path="users"
            element={
              <RequirePermission perm={PERM.usersView}>
                <UsersAdmin />
              </RequirePermission>
            }
          />
          <Route
            path="finance"
            element={
              <RequirePermission perm={PERM.financeView}>
                <FinanceModule />
              </RequirePermission>
            }
          />
          <Route
            path="quotes"
            element={
              <RequirePermission perm={PERM.quotesView}>
                <QuotesModule />
              </RequirePermission>
            }
          />
          <Route
            path="quotes/:id"
            element={
              <RequirePermission perm={PERM.quotesView}>
                <QuotePage />
              </RequirePermission>
            }
          />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
