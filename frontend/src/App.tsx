import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { authApi, extractSessionIdFromUrl } from './lib/api'
import { useWizard } from './contexts/WizardContext'
import Stepper from './components/Stepper/Stepper'
import StepCards from './components/StepCards/StepCards'
import GoogleAuthStep from './components/Steps/GoogleAuthStep'
import JiraSetupStep from './components/Steps/JiraSetupStep'
import SheetConfigStep from './components/Steps/SheetConfigStep'
import GenerateStep from './components/Steps/GenerateStep'
import PrivacyPolicy from './pages/PrivacyPolicy'

const STEPS = [
  { id: 0, title: 'Sign In', icon: 'user' },
  { id: 1, title: 'Jira Setup', icon: 'settings' },
  { id: 2, title: 'Sheet Config', icon: 'file' },
  { id: 3, title: 'Generate', icon: 'sparkles' },
]

// Extract session ID from URL on initial load (before any API calls)
extractSessionIdFromUrl()

// Simple router - check if on privacy policy page
const isPrivacyPolicyPage = window.location.pathname === '/privacy-policy'

function App() {
  const { state, dispatch } = useWizard()

  const { data: authStatus, refetch: refetchAuth } = useQuery({
    queryKey: ['authStatus'],
    queryFn: authApi.getStatus,
    refetchInterval: false,
  })

  useEffect(() => {
    if (authStatus) {
      dispatch({ type: 'SET_AUTH_STATUS', payload: authStatus })
    }
  }, [authStatus, dispatch])

  // Reset to step 0 if session expired but user was on a later step
  useEffect(() => {
    if (authStatus) {
      const isAuthenticated = authStatus.google.authenticated && authStatus.atlassian.authenticated
      if (!isAuthenticated && state.currentStep > 0) {
        dispatch({ type: 'SET_STEP', payload: 0 })
      }
    }
  }, [authStatus, state.currentStep, dispatch])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const success = params.get('success')
    const error = params.get('error')
    const provider = params.get('provider')

    if (success) {
      toast.success(`Successfully signed in with ${success === 'google' ? 'Google' : 'Atlassian'}!`)
      // Clear URL, then refetch
      window.history.replaceState({}, '', window.location.pathname)
      setTimeout(async () => {
        const result = await refetchAuth()
        if (result.data) {
          dispatch({ type: 'SET_AUTH_STATUS', payload: result.data })
        }
      }, 100)
    }

    if (error) {
      const providerName = provider === 'google' ? 'Google' : 'Atlassian'
      toast.error(`Failed to sign in with ${providerName}: ${error.replace(/_/g, ' ')}`)
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [refetchAuth, dispatch])

  const renderCurrentStep = () => {
    switch (state.currentStep) {
      case 0:
        return <GoogleAuthStep />
      case 1:
        return <JiraSetupStep />
      case 2:
        return <SheetConfigStep />
      case 3:
        return <GenerateStep />
      default:
        return <GoogleAuthStep />
    }
  }

  // Render privacy policy page if on that route
  if (isPrivacyPolicyPage) {
    return <PrivacyPolicy />
  }

  return (
    <div className="min-h-screen bg-neutral-light-grey">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="bg-white rounded-2xl shadow-lg p-8">
          <h1 className="text-2xl font-bold text-text-primary text-center mb-2">
            Test Case Generator
          </h1>
          <p className="text-text-tertiary text-center mb-8">
            Generate test cases from Jira using AI and write to Google Sheets
          </p>

          <Stepper steps={STEPS} currentStep={state.currentStep} />

          <div className="mt-8">
            <StepCards />
          </div>

          <div className="mt-8 border-t border-neutral-lightest-grey pt-8">
            {renderCurrentStep()}
          </div>

          <footer className="mt-8 pt-4 border-t border-neutral-lightest-grey text-center">
            <a 
              href="/privacy-policy" 
              className="text-text-tertiary hover:text-text-secondary text-sm"
            >
              Privacy Policy
            </a>
          </footer>
        </div>
      </div>
    </div>
  )
}

export default App
