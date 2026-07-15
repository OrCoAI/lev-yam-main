import {
  startRegistration,
  startAuthentication,
  browserSupportsWebAuthn,
} from '@simplewebauthn/browser'
import { supabase, invokeFunction } from './supabase'

// All passkey crypto/verification happens in the `passkey-verify` Edge Function;
// this module only drives the browser WebAuthn calls and exchanges the result.

const invoke = <T>(body: Record<string, unknown>) => invokeFunction<T>('passkey-verify', body)

/** True only when this device has a built-in biometric authenticator (Touch ID / Face ID). */
export async function platformAuthenticatorAvailable(): Promise<boolean> {
  if (!browserSupportsWebAuthn()) return false
  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
  } catch {
    return false
  }
}

/** Register a passkey for the currently signed-in user (call after a normal login). */
export async function registerPasskey(label?: string): Promise<void> {
  const { options, challengeId } = await invoke<{ options: unknown; challengeId: string }>({
    action: 'register/options',
  })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const response = await startRegistration(options as any)
  await invoke({ action: 'register/verify', challengeId, response, label })
}

/** Sign in with a passkey (no email needed — the device offers its stored credentials). */
export async function loginWithPasskey(): Promise<void> {
  const { options, challengeId } = await invoke<{ options: unknown; challengeId: string }>({
    action: 'login/options',
  })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const response = await startAuthentication(options as any)
  const { token_hash } = await invoke<{ token_hash: string }>({
    action: 'login/verify',
    challengeId,
    response,
  })
  const { error } = await supabase.auth.verifyOtp({ token_hash, type: 'magiclink' })
  if (error) throw new Error(error.message)
}

export interface PasskeyRow {
  id: string
  label: string | null
  created_at: string
  last_used_at: string | null
}

export async function listMyPasskeys(): Promise<PasskeyRow[]> {
  const { data, error } = await supabase
    .schema('core')
    .from('passkeys')
    .select('id, label, created_at, last_used_at')
    .order('created_at')
  if (error) throw new Error(error.message)
  return (data as PasskeyRow[] | null) ?? []
}

export async function removePasskey(id: string): Promise<void> {
  const { error } = await supabase.schema('core').from('passkeys').delete().eq('id', id)
  if (error) throw new Error(error.message)
}
