/**
 * Global Error Formatter Utility for TERMCAT & School Connect System
 * Converts Supabase API errors, Postgres database constraints, network drops,
 * and runtime JS exceptions into detailed, clear, and actionable error messages.
 */

export interface DetailedErrorOptions {
  action?: string
  table?: string
}

export function formatDetailedError(err: any, options?: DetailedErrorOptions | string): string {
  const actionPrefix = typeof options === 'string' ? options : options?.action || 'Operation failed'
  const tableName = typeof options === 'object' ? options?.table : undefined

  // Always log complete raw error trace to browser console for developer debugging
  console.error(`[TERMCAT ERROR TRACE] ${actionPrefix}:`, err)

  if (!err) {
    return `${actionPrefix}: Unknown error encountered.`
  }

  // Handle direct string errors
  if (typeof err === 'string') {
    return `${actionPrefix}: ${err}`
  }

  // Extract Supabase / PostgREST / PostgreSQL error properties
  const code = err.code || err.status || (err.error ? err.error.code : undefined)
  const rawMsg = err.message || err.error_description || err.details || (typeof err === 'object' ? (err.statusText || JSON.stringify(err)) : String(err))
  const hint = err.hint ? ` | Hint: ${err.hint}` : ''
  const details = err.details ? ` | Details: ${err.details}` : ''

  const lowerMsg = (rawMsg || '').toLowerCase()

  // 1. Network & Socket Errors (ERR_CONNECTION_CLOSED, Failed to fetch, Offline)
  if (
    lowerMsg.includes('failed to fetch') ||
    lowerMsg.includes('err_connection_closed') ||
    lowerMsg.includes('networkerror') ||
    lowerMsg.includes('network error') ||
    err.status === 0
  ) {
    return `${actionPrefix}: [Network Error ERR_CONNECTION_CLOSED] Failed to connect to Supabase server. Please check your internet connection.`
  }

  // 2. Row Level Security (RLS) Permission Denied (42501 / 401)
  if (code === '42501' || err.status === 401 || lowerMsg.includes('row-level security') || lowerMsg.includes('permission denied')) {
    const tblInfo = tableName ? ` on table "${tableName}"` : ''
    return `${actionPrefix}: [Supabase RLS Error 42501/401] Access Permission Denied${tblInfo}. Message: "${rawMsg}". Ensure migration script (013/014) has been executed in Supabase SQL Editor.`
  }

  // 3. Unique Constraint Violation / Duplicate Record Conflict (23505 / 409)
  if (code === '23505' || err.status === 409 || lowerMsg.includes('unique') || lowerMsg.includes('duplicate')) {
    const tblInfo = tableName ? ` on table "${tableName}"` : ''
    return `${actionPrefix}: [Supabase Conflict Error 23505/409] Duplicate Record Conflict${tblInfo}. Message: "${rawMsg}"${details}.`
  }

  // 4. Foreign Key Constraint Violation (23503)
  if (code === '23503' || lowerMsg.includes('foreign key constraint')) {
    const tblInfo = tableName ? ` on table "${tableName}"` : ''
    return `${actionPrefix}: [Supabase Constraint Error 23503] Invalid reference${tblInfo}. Referenced record does not exist in database${details}${hint}.`
  }

  // 5. Not Null Column Violation (23502)
  if (code === '23502' || lowerMsg.includes('null value in column')) {
    const tblInfo = tableName ? ` on table "${tableName}"` : ''
    return `${actionPrefix}: [Supabase Schema Error 23502] Missing required field${tblInfo}${details}${hint}.`
  }

  // 6. Missing Table / Endpoint (42P01 / PGRST204 / PGRST205)
  if (code === '42P01' || code === 'PGRST204' || code === 'PGRST205' || lowerMsg.includes('relation') || lowerMsg.includes('does not exist')) {
    const tblInfo = tableName ? ` on table "${tableName}"` : ''
    return `${actionPrefix}: [Supabase Schema Error ${code || '42P01'}] Table or route does not exist${tblInfo}. Message: "${rawMsg}".`
  }

  // 7. Generic PostgREST / Supabase Error with Code
  if (code) {
    return `${actionPrefix}: [Supabase Error Code ${code}] ${rawMsg}${details}${hint}`
  }

  // Fallback default
  return `${actionPrefix}: ${rawMsg}${details}`
}
