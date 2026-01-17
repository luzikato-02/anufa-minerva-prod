export {}

declare global {
  interface Window {
    platform?: {
      minimize: () => void
      maximize: () => void
      close: () => void
    }
    electronAPI?: {
      showServerConfig?: () => void
      onTriggerSync?: (cb: () => void) => void
      onShowSyncLog?: (cb: () => void) => void
    }
  }
}
