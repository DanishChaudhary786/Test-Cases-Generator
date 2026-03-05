import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import App from './App'
import { WizardProvider } from './contexts/WizardContext'
import './index.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <WizardProvider>
        <App />
        <Toaster 
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: '#fff',
              color: '#101010',
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            },
            success: {
              iconTheme: {
                primary: '#13be66',
                secondary: '#fff',
              },
            },
            error: {
              iconTheme: {
                primary: '#ff0000',
                secondary: '#fff',
              },
            },
          }}
        />
      </WizardProvider>
    </QueryClientProvider>
  </StrictMode>,
)
