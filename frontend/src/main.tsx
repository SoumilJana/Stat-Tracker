import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { registerSW } from 'virtual:pwa-register'
import { handleNewVersion, scheduleUpdateChecks } from './lib/appUpdate'

registerSW({
  immediate: true,
  // A new version has taken over: reload now, or once off the match screens
  onNeedReload() {
    handleNewVersion()
  },
  onRegisteredSW(_swUrl, registration) {
    scheduleUpdateChecks(registration)
  },
  onOfflineReady() {},
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
