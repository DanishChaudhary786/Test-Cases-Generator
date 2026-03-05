export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-neutral-light-grey py-12 px-4">
      <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-lg p-8">
        <h1 className="text-3xl font-bold text-text-primary mb-6">Privacy Policy</h1>
        <p className="text-text-secondary mb-4">Last updated: March 5, 2026</p>
        
        <section className="mb-6">
          <h2 className="text-xl font-semibold text-text-primary mb-3">1. Information We Collect</h2>
          <p className="text-text-secondary">
            Test Case Generator collects the following information when you use our service:
          </p>
          <ul className="list-disc list-inside text-text-secondary mt-2 space-y-1">
            <li>Google account email and name (for Google Sheets access)</li>
            <li>Atlassian account email and name (for Jira access)</li>
            <li>Jira project data you choose to process</li>
          </ul>
        </section>

        <section className="mb-6">
          <h2 className="text-xl font-semibold text-text-primary mb-3">2. How We Use Your Information</h2>
          <p className="text-text-secondary">
            We use your information solely to:
          </p>
          <ul className="list-disc list-inside text-text-secondary mt-2 space-y-1">
            <li>Authenticate you with Google and Atlassian services</li>
            <li>Read Jira issues to generate test cases</li>
            <li>Write generated test cases to your Google Sheets</li>
          </ul>
        </section>

        <section className="mb-6">
          <h2 className="text-xl font-semibold text-text-primary mb-3">3. Data Storage</h2>
          <p className="text-text-secondary">
            We do not permanently store your data. Authentication tokens are stored temporarily 
            in server memory during your session and are cleared when you log out or your session expires.
          </p>
        </section>

        <section className="mb-6">
          <h2 className="text-xl font-semibold text-text-primary mb-3">4. Third-Party Services</h2>
          <p className="text-text-secondary">
            This application integrates with:
          </p>
          <ul className="list-disc list-inside text-text-secondary mt-2 space-y-1">
            <li>Google (for Sheets API access)</li>
            <li>Atlassian (for Jira API access)</li>
            <li>AI providers (Anthropic, OpenAI, or Google AI) for test case generation</li>
          </ul>
        </section>

        <section className="mb-6">
          <h2 className="text-xl font-semibold text-text-primary mb-3">5. Contact</h2>
          <p className="text-text-secondary">
            For questions about this privacy policy, contact: danish.chaudhary752@gmail.com
          </p>
        </section>

        <div className="mt-8 pt-6 border-t border-neutral-lightest-grey">
          <a 
            href="/" 
            className="text-brand-primary hover:text-brand-primary-dark font-medium"
          >
            ← Back to App
          </a>
        </div>
      </div>
    </div>
  );
}
