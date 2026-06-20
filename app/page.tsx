"use client";

import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();

  return (
    <div className="container page-transition-enter" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
      <div className="glass-panel" style={{ padding: '3rem', maxWidth: '500px', width: '100%', textAlign: 'center' }}>
        <h1 style={{ marginBottom: '0.5rem', color: 'var(--accent-primary)' }}>BiteSpeed</h1>
        <h2 style={{ marginBottom: '2rem', fontSize: '1.25rem', color: 'var(--text-secondary)' }}>Onboarding OS Gateway</h2>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <button className="btn-primary" onClick={() => router.push('/om')}>
            Login as Onboarding Manager
          </button>
          
          <button className="btn-primary" onClick={() => router.push('/specialist')} style={{ background: 'var(--surface-elevated)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }}>
            Login as Implementation Specialist
          </button>
          
          <button className="btn-primary" onClick={() => router.push('/backstop')} style={{ background: 'var(--surface-elevated)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }}>
            Login as Backstop Reviewer (CS Head)
          </button>
          
          <div style={{ margin: '1.5rem 0', height: '1px', background: 'var(--border-color)' }} />

          <button className="btn-primary" onClick={() => router.push('/intake')} style={{ background: 'var(--surface-elevated)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }}>
            New Account Intake Form
          </button>
          
          <button className="btn-primary" onClick={() => router.push('/review')} style={{ background: 'var(--surface-elevated)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }}>
            Weekly Review Dashboard
          </button>
          
          <div style={{ margin: '1.5rem 0', height: '1px', background: 'var(--border-color)' }} />
          
          <button className="btn-primary" onClick={() => router.push('/portal/BS-TRIAL-001')} style={{ background: 'var(--status-green-bg)', color: 'var(--status-green)' }}>
            Enter Customer Portal (Demo)
          </button>
        </div>
      </div>
    </div>
  );
}
