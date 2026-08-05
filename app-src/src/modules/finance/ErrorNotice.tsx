// The module's one error strip — same shape as the users module's ErrorNotice
// (modules/users/UsersAdmin.tsx), which this folder had open-coded at four
// separate call sites.
import { useFT } from './i18n'

export default function ErrorNotice({ error }: { error: string }) {
  const ft = useFT()
  return (
    <div className="error">
      {ft.errorPrefix} {error}
    </div>
  )
}
