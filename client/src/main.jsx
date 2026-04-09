import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'  // to use navigate tag for protected routes
import { AuthProvider } from './context/AuthContext.jsx';
import App from './App.jsx'
import './index.css'

{/* <StrictMode>  */}
{/* ... */ }
{/* </StrictMode>  */}
createRoot(document.getElementById('root')).render(
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
)
