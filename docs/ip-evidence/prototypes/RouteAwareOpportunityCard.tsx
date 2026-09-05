import React from 'react';

type OpportunityControl = 'Approve checklist' | 'Dismiss' | 'Correct pantry' | 'Disable route nudges' | 'Delete sample';

export interface RouteAwareOpportunityCardProps {
  title: string;
  whyNow: string;
  sourceSignals: string[];
  consentTier: string;
  confidence: string;
  actionEscrowState: 'approval_required' | 'blocked' | 'demo_only';
  controls?: OpportunityControl[];
}

export function RouteAwareOpportunityCard({
  title,
  whyNow,
  sourceSignals,
  consentTier,
  confidence,
  actionEscrowState,
  controls = ['Approve checklist', 'Dismiss', 'Correct pantry', 'Disable route nudges', 'Delete sample'],
}: RouteAwareOpportunityCardProps) {
  return (
    <section aria-label="Route-aware opportunity" data-ip-family="URAI-008" data-demo-only="true">
      <header>
        <p>Privacy-safe synthetic demo</p>
        <h2>{title}</h2>
      </header>

      <p>{whyNow}</p>

      <dl>
        <dt>Confidence</dt>
        <dd>{confidence}</dd>
        <dt>Consent tier</dt>
        <dd>{consentTier}</dd>
        <dt>Action state</dt>
        <dd>{actionEscrowState}</dd>
      </dl>

      <h3>Why you are seeing this</h3>
      <ul>
        {sourceSignals.map((signal) => (
          <li key={signal}>{signal}</li>
        ))}
      </ul>

      <h3>User controls</h3>
      <div>
        {controls.map((control) => (
          <button key={control} type="button">
            {control}
          </button>
        ))}
      </div>

      <p>
        This card is prototype evidence only. It must not initiate purchases, messages, scheduling, provider
        calls, or live passive collection without explicit approval, audit, and evidence gates.
      </p>
    </section>
  );
}
