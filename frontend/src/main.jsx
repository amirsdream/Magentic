import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { AuthProvider } from './contexts/AuthContext'

// Initialize theme from localStorage before render to prevent flash
try {
  const storedData = localStorage.getItem('magentic-ui-storage');
  if (storedData) {
    const parsed = JSON.parse(storedData);
    const theme = parsed?.state?.theme || 'dark';
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  } else {
    // Default to dark if no stored preference
    document.documentElement.classList.add('dark');
  }
} catch (e) {
  // Default to dark on error
  document.documentElement.classList.add('dark');
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </React.StrictMode>,
)
