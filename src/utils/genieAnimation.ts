/**
 * Captures the clicked button/element's screen coordinates
 * and sets CSS custom variables --genie-origin-x and --genie-origin-y
 * so modals visually originate from the exact clicked button position.
 */
export function captureGenieOrigin(eventOrElement?: React.MouseEvent | HTMLElement | EventTarget | null) {
  if (typeof window === 'undefined') return

  let targetEl: HTMLElement | null = null

  if (eventOrElement && 'currentTarget' in eventOrElement && eventOrElement.currentTarget instanceof HTMLElement) {
    targetEl = eventOrElement.currentTarget
  } else if (eventOrElement && 'target' in eventOrElement && eventOrElement.target instanceof HTMLElement) {
    targetEl = (eventOrElement.target.closest('button, a, [role="button"]') as HTMLElement) || eventOrElement.target
  } else if (eventOrElement instanceof HTMLElement) {
    targetEl = eventOrElement
  }

  if (!targetEl) {
    document.documentElement.style.setProperty('--genie-origin-x', '0px')
    document.documentElement.style.setProperty('--genie-origin-y', '0px')
    return
  }

  const rect = targetEl.getBoundingClientRect()
  const viewportCenterX = window.innerWidth / 2
  const viewportCenterY = window.innerHeight / 2

  const buttonCenterX = rect.left + rect.width / 2
  const buttonCenterY = rect.top + rect.height / 2

  const originX = buttonCenterX - viewportCenterX
  const originY = buttonCenterY - viewportCenterY

  document.documentElement.style.setProperty('--genie-origin-x', `${Math.round(originX)}px`)
  document.documentElement.style.setProperty('--genie-origin-y', `${Math.round(originY)}px`)
}

import { useState, useEffect, useRef } from 'react'

/**
 * Custom React hook for controlling Genie opening and closing reverse animations.
 * Provides CSS classes and a safe triggerClose function that plays the reverse
 * genieContract animation before unmounting/firing onClose.
 */
export function useGenieModal(isOpen: boolean, onClose?: () => void) {
  const [shouldRender, setShouldRender] = useState(isOpen)
  const [isClosing, setIsClosing] = useState(false)
  const isClosingRef = useRef(false)

  useEffect(() => {
    if (isOpen) {
      setShouldRender(true)
      setIsClosing(false)
      isClosingRef.current = false
    } else if (shouldRender && !isClosingRef.current) {
      setIsClosing(true)
      isClosingRef.current = true
      const timer = setTimeout(() => {
        setShouldRender(false)
        setIsClosing(false)
        isClosingRef.current = false
      }, 400)
      return () => clearTimeout(timer)
    }
  }, [isOpen])

  const triggerClose = () => {
    if (isClosingRef.current) return
    setIsClosing(true)
    isClosingRef.current = true
    setTimeout(() => {
      setShouldRender(false)
      setIsClosing(false)
      isClosingRef.current = false
      if (onClose) onClose()
    }, 400)
  }

  return {
    shouldRender,
    isClosing,
    triggerClose,
    containerClass: isClosing ? 'animate-genie-contract' : 'animate-genie-expand',
    backdropClass: isClosing ? 'animate-fade-out' : 'animate-fade-in',
  }
}
