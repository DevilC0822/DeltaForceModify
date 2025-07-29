import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HeroUIProvider, ToastProvider } from '@heroui/react'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HeroUIProvider>
      <ToastProvider 
        placement="top-right"
        toastOffset={20}
        maxVisibleToasts={3}
        toastProps={{
          radius: "lg",
          variant: "flat",
          timeout: 4000,
        }}
      />
      <App />
    </HeroUIProvider>
  </StrictMode>,
)
