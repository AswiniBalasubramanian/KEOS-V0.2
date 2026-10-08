import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './tailwind.css'
import './index.css'
import './components/arc/foundation.css'
import App from './App.tsx'
import { TipProvider } from './Tip'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <TipProvider>
      <App />
    </TipProvider>
  </StrictMode>,
)
