import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { invalidateLISCache } from '@/lib/supabase/queries'

interface UseLISRealtimeOptions {
  onUpdate?: () => void
  enabled?: boolean
}

export function useLISRealtimeSync({ onUpdate, enabled = true }: UseLISRealtimeOptions = {}) {
  const [isLive, setIsLive] = useState(false)
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const onUpdateRef = useRef(onUpdate)

  useEffect(() => {
    onUpdateRef.current = onUpdate
  }, [onUpdate])

  useEffect(() => {
    if (!enabled) return

    const handlePayload = (payload: any) => {
      console.log('[LIS Realtime] Change detected on:', payload.table, payload.eventType)
      invalidateLISCache()

      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }

      debounceTimerRef.current = setTimeout(() => {
        if (onUpdateRef.current) {
          onUpdateRef.current()
        }
      }, 400)
    }

    const channel = supabase
      .channel(`lis-realtime-${Math.random().toString(36).substring(2, 9)}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'sc_learners' },
        handlePayload
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'sc_schools' },
        handlePayload
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'sc_grade_levels' },
        handlePayload
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'sc_sections' },
        handlePayload
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setIsLive(true)
        } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          setIsLive(false)
        }
      })

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
      supabase.removeChannel(channel)
    }
  }, [enabled])

  return { isLive }
}
