import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './bingo.css'
import './v4.css'
import './office/errands'
import App from './App.tsx'
import Dialogos from './components/Dialogo'
import './turmeo.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    <Dialogos />
  </StrictMode>,
)
