import { Routes, Route, Navigate } from 'react-router-dom'
import Login from './shell/Login'
import ResetPassword from './shell/ResetPassword'
import RequireAuth from './shell/RequireAuth'
import RequirePermission from './shell/RequirePermission'
import Layout from './shell/Layout'
import Launcher from './shell/Launcher'
import { ExitPreviewOnEntry } from './shell/PreviewBanner'
import UsersAdmin from './modules/users/UsersAdmin'
import FinanceModule from './modules/finance/FinanceModule'
import PosModule from './modules/pos/PosModule'
import QuotesModule from './modules/quotes/QuotesModule'
import QuotePage from './modules/quotes/QuotePage'
import ContractPage from './modules/quotes/ContractPage'
import { PERM } from './lib/permissions'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/reset-password" element={<ResetPassword />} />

      {/* Everything below requires a session */}
      <Route element={<RequireAuth />}>
        {/* POS is full-screen (its own headers/dock, phone-first floor UI) — no shell
            Layout. A view-as preview ENDS here (see ExitPreviewOnEntry): its
            100dvh layout can't host the banner, and POS must never render
            under someone else's permission mirror unlabeled. */}
        <Route
          path="pos"
          element={
            <>
              <ExitPreviewOnEntry />
              <RequirePermission perm={PERM.posView}>
                <PosModule />
              </RequirePermission>
            </>
          }
        />
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
          <Route
            path="quotes/:id/contract"
            element={
              <RequirePermission perm={PERM.quotesView}>
                <ContractPage />
              </RequirePermission>
            }
          />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
