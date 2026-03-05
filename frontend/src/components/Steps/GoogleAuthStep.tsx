import { useWizard } from '../../contexts/WizardContext'
import { authApi } from '../../lib/api'
import { Check, ExternalLink, LogOut } from 'lucide-react'
import clsx from 'clsx'

export default function GoogleAuthStep() {
  const { state, dispatch, nextStep, canProceedToStep } = useWizard()
  const { authStatus } = state

  const handleLogout = async (provider: 'google' | 'atlassian') => {
    await authApi.logout(provider)
    const newStatus = await authApi.getStatus()
    dispatch({ type: 'SET_AUTH_STATUS', payload: newStatus })
  }

  const canProceed = canProceedToStep(1)

  return (
    <div className="max-w-2xl mx-auto">
      <div className="text-center mb-8">
        <h2 className="text-xl font-semibold text-text-primary mb-2">
          Sign in to Get Started
        </h2>
        <p className="text-text-tertiary">
          We need access to your Google account for writing test cases to Google Sheets, 
          and your Atlassian account for fetching Jira data.
        </p>
      </div>

      <div className="space-y-4">
        {/* Google OAuth */}
        <div
          className={clsx(
            'p-6 rounded-xl border-2 transition-all',
            authStatus?.google.authenticated
              ? 'border-success-primary bg-success-secondary/20'
              : 'border-neutral-grey bg-white hover:border-neutral-dark-grey'
          )}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-white shadow-sm flex items-center justify-center">
                <svg className="w-6 h-6" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-text-primary">Google Account</h3>
                <p className="text-sm text-text-tertiary">
                  {authStatus?.google.authenticated
                    ? authStatus.google.email
                    : 'Required for Google Sheets access'}
                </p>
              </div>
            </div>

            {authStatus?.google.authenticated ? (
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1 text-success-primary text-sm font-medium">
                  <Check className="w-4 h-4" />
                  Connected
                </span>
                <button
                  onClick={() => handleLogout('google')}
                  className="p-2 text-text-tertiary hover:text-failure-primary transition-colors"
                  title="Sign out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <a
                href={authApi.getGoogleAuthUrl()}
                className="inline-flex items-center gap-2 px-4 py-2 bg-text-primary text-white rounded-lg hover:bg-text-secondary transition-colors"
              >
                Sign in
                <ExternalLink className="w-4 h-4" />
              </a>
            )}
          </div>
        </div>

        {/* Atlassian OAuth */}
        <div
          className={clsx(
            'p-6 rounded-xl border-2 transition-all',
            authStatus?.atlassian.authenticated
              ? 'border-success-primary bg-success-secondary/20'
              : 'border-neutral-grey bg-white hover:border-neutral-dark-grey'
          )}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-white shadow-sm flex items-center justify-center">
                <svg className="w-6 h-6" viewBox="0 0 24 24">
                  <defs>
                    <linearGradient id="atlassian-gradient" x1="99.99%" x2="24.08%" y1="29.21%" y2="73.74%">
                      <stop offset="0%" stopColor="#0052CC" />
                      <stop offset="100%" stopColor="#2684FF" />
                    </linearGradient>
                  </defs>
                  <path
                    fill="url(#atlassian-gradient)"
                    d="M7.81 10.69c-.19-.26-.54-.28-.77-.05L2.16 17.5c-.17.21-.14.52.08.69.07.06.16.09.25.09h6.73c.2 0 .38-.12.46-.31.73-1.63.33-5.4-1.87-7.28zM11.44 2.15c-2.47 4.01-2.27 8.58.55 12.31l3.6 4.76c.14.18.35.28.57.28h6.73c.27 0 .5-.22.5-.5 0-.11-.04-.21-.1-.3L12.21 2.1c-.17-.24-.51-.3-.77-.15a.56.56 0 0 0 0 .2z"
                  />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-text-primary">Atlassian Account</h3>
                <p className="text-sm text-text-tertiary">
                  {authStatus?.atlassian.authenticated
                    ? `${authStatus.atlassian.siteName} (${authStatus.atlassian.email})`
                    : 'Required for Jira access'}
                </p>
              </div>
            </div>

            {authStatus?.atlassian.authenticated ? (
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1 text-success-primary text-sm font-medium">
                  <Check className="w-4 h-4" />
                  Connected
                </span>
                <button
                  onClick={() => handleLogout('atlassian')}
                  className="p-2 text-text-tertiary hover:text-failure-primary transition-colors"
                  title="Sign out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <a
                href={authApi.getAtlassianAuthUrl()}
                className="inline-flex items-center gap-2 px-4 py-2 bg-[#0052CC] text-white rounded-lg hover:bg-[#0747A6] transition-colors"
              >
                Sign in
                <ExternalLink className="w-4 h-4" />
              </a>
            )}
          </div>
        </div>
      </div>

      <div className="mt-8 flex justify-end">
        <button
          onClick={nextStep}
          disabled={!canProceed}
          className={clsx(
            'px-6 py-3 rounded-lg font-medium transition-all',
            canProceed
              ? 'bg-success-primary text-white hover:bg-success-primary/90'
              : 'bg-neutral-grey text-text-tertiary cursor-not-allowed'
          )}
        >
          Continue to Jira Setup
        </button>
      </div>
    </div>
  )
}
