/**
 * Captures clicked element coordinates (no-op retained for backwards compatibility)
 */
export function captureGenieOrigin(_eventOrElement?: any) {
  if (typeof window === 'undefined') return
  document.documentElement.style.setProperty('--genie-origin-x', '0px')
  document.documentElement.style.setProperty('--genie-origin-y', '0px')
}

/**
 * Instant React hook for modals (disables all genie zoom & delay animations)
 */
export function useGenieModal(isOpen: boolean, onClose?: () => void) {
  const triggerClose = () => {
    if (onClose) onClose()
  }

  return {
    shouldRender: isOpen,
    isClosing: false,
    triggerClose,
    containerClass: '',
    backdropClass: '',
  }
}
