import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './v4.css'
import './office/errands'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
