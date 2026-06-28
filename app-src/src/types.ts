// Mirrors of the `core` schema rows used across the platform UI.

export interface ModuleRow {
  id: string
  key: string
  label: string
  icon: string | null
  enabled: boolean
  sort: number
}

export interface RoleRow {
  id: string
  key: string
  label: string
  sort: number
}

export interface PermissionRow {
  id: string
  key: string
  module: string
  action: string
  label: string
}

export interface RolePermissionRow {
  role_id: string
  permission_id: string
}

export interface AdminUser {
  user_id: string
  email: string | null
  created_at: string
  roles: string[]
}
