import { LangToggle } from '../lib/i18n'

/** Shared chrome for the pre-app auth screens (Login's two modes + ResetPassword). */
export default function AuthHeader({ title }: { title: string }) {
  return (
    <>
      <LangToggle className="login-lang" />
      <img className="login-logo" src="/app/brand/logo-full.png" alt="לב ים" />
      <h1 className="login-title">{title}</h1>
    </>
  )
}
