
'use client';

import { useState } from 'react';

export default function DSARPage() {
  const [email, setEmail] = useState('');
  const [requestType, setRequestType] = useState('export');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setMessage('');

    // The following line will be replaced with a call to the cloud function
    console.log('Submitting DSAR:', { email, requestType });

    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      setMessage('Verification required. Please check your email for a link to confirm your request.');
      setEmail('');
    } catch (error) {
      setMessage('An error occurred. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <article>
      <h1>Data Subject Access Request (DSAR)</h1>
      <p>You can use this form to submit a request regarding your personal data. We will send a verification link to your email address to prevent unauthorized requests.</p>

      <form onSubmit={handleSubmit} className="space-y-6 mt-8 max-w-lg mx-auto">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-text-secondary">Email Address</label>
          <input
            type="email"
            id="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="mt-1 block w-full bg-surface border-border rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-accent focus:border-accent sm:text-sm"
          />
        </div>

        <div>
          <label htmlFor="requestType" className="block text-sm font-medium text-text-secondary">Request Type</label>
          <select
            id="requestType"
            value={requestType}
            onChange={(e) => setRequestType(e.target.value)}
            required
            className="mt-1 block w-full bg-surface border-border rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-accent focus:border-accent sm:text-sm"
          >
            <option value="export">Export my data</option>
            <option value="delete">Delete my data</option>
            <option value="correct">Correct my data</option>
          </select>
        </div>

        <div className="text-right">
          <button type="submit" disabled={isSubmitting} className="px-6 py-2 bg-accent text-accent-foreground rounded-md font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed">
            {isSubmitting ? 'Submitting...' : 'Submit Request'}
          </button>
        </div>
      </form>

      {message && <p className="mt-4 text-center text-text-secondary">{message}</p>}
    </article>
  );
}
