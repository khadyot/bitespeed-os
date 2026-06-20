import { prisma } from '@/lib/db';
import { computeStage, getTrialDay } from '@/lib/coreLogic';
import { askQuestion } from '@/app/actions';

export const dynamic = 'force-dynamic';

export default async function CustomerPortal({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const account = await prisma.account.findUnique({
    where: { id },
    include: { tracks: true, om: true, updateLogs: { orderBy: { created_at: 'desc' }, take: 10 } }
  });

  if (!account) return <div className="container" style={{ textAlign: 'center', paddingTop: '4rem' }}><h1>Account not found</h1></div>;

  const stage = computeStage(account.conversion_status, account.trial_start_date, account.initial_plan_value_inr);
  const trialDay = getTrialDay(account.trial_start_date);
  
  // Plain language stage mapping
  const stageLabel = stage.includes('Trial') ? 'Active Trial'
    : stage.includes('Extended') ? 'Extended Trial Period'
    : stage.includes('Post-Conversion') ? 'Onboarding (Post-Conversion)'
    : stage.includes('Closed') ? 'Closed'
    : stage;

  const applicableTracks = account.tracks.filter(t => t.status !== 'not_applicable');
  const completedTracks = applicableTracks.filter(t => t.status === 'complete');
  const progressPct = applicableTracks.length > 0 ? Math.round((completedTracks.length / applicableTracks.length) * 100) : 100;
  
  const customerTasks = account.tracks.filter(t => t.owner_type === 'Customer' && t.status !== 'complete' && t.status !== 'not_applicable');
  const bitespeedTasks = account.tracks.filter(t => t.owner_type !== 'Customer' && t.status !== 'complete' && t.status !== 'not_applicable');

  const TRACK_LABELS: Record<string, { title: string; customerDesc: string; bsDesc: string }> = {
    dns: { title: 'Email Domain Setup', customerDesc: 'Add DNS records from your domain provider', bsDesc: 'Verifying your domain records' },
    migration: { title: 'Platform Migration', customerDesc: 'Provide access to your current platform', bsDesc: 'Auditing and migrating your existing flows' },
    chatbot: { title: 'AI Chatbot', customerDesc: 'Review chatbot configuration', bsDesc: 'Building your custom chatbot with our partner' },
    warmup: { title: 'Email Warmup', customerDesc: 'No action needed — automatic process', bsDesc: 'Warming up your sending reputation' },
  };

  const askQuestionWithId = askQuestion.bind(null, account.id);

  const customerUpdates = account.updateLogs.filter(u => u.type === 'customer_update');

  return (
    <div style={{ maxWidth: '700px', margin: '0 auto', padding: '2rem' }} className="page-transition-enter">
      {/* Welcome header */}
      <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
        <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))', margin: '0 auto 1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem' }}>
          {account.brand_name.charAt(0)}
        </div>
        <h1 style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>{account.brand_name}</h1>
        <p style={{ color: 'var(--text-secondary)' }}>Your onboarding with BiteSpeed</p>
      </div>

      {/* Stage + Progress card */}
      <div className="glass-panel" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <div>
            <p style={{ color: 'var(--text-tertiary)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Current Phase</p>
            <p style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-primary)', marginTop: '0.25rem' }}>{stageLabel}</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ color: 'var(--text-tertiary)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Progress</p>
            <p style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--accent-primary)', marginTop: '0.25rem' }}>{progressPct}%</p>
          </div>
        </div>
        
        {/* Progress bar */}
        <div style={{ height: '8px', background: 'var(--surface-elevated)', borderRadius: '4px', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${progressPct}%`, background: 'linear-gradient(90deg, var(--accent-primary), var(--accent-secondary))', borderRadius: '4px', transition: 'width 0.5s ease' }} />
        </div>
        
        {/* Track pills */}
        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', flexWrap: 'wrap' }}>
          {applicableTracks.map(track => (
            <div key={track.id} style={{
              padding: '0.35rem 0.75rem', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 500,
              background: track.status === 'complete' ? 'var(--status-green-bg)' : track.status === 'blocked' ? 'var(--status-red-bg)' : 'var(--surface-elevated)',
              color: track.status === 'complete' ? 'var(--status-green)' : track.status === 'blocked' ? 'var(--status-red)' : 'var(--text-secondary)',
            }}>
              {track.status === 'complete' ? '✓' : track.status === 'blocked' ? '!' : '○'} {TRACK_LABELS[track.type]?.title || track.type}
            </div>
          ))}
        </div>
      </div>

      {/* Your OM */}
      <div className="card" style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: 'var(--accent-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: '1rem', flexShrink: 0 }}>
          {account.om?.name?.charAt(0) || '?'}
        </div>
        <div>
          <p style={{ fontWeight: 600 }}>{account.om?.name || 'Not assigned'}</p>
          <p style={{ color: 'var(--text-tertiary)', fontSize: '0.8rem' }}>Your Onboarding Manager — reach out anytime</p>
        </div>
      </div>

      {/* What's pending */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
        <div className="card" style={{ borderTop: '3px solid var(--status-amber)' }}>
          <h3 style={{ fontSize: '0.9rem', marginBottom: '0.75rem', color: 'var(--status-amber)' }}>Action Needed From You</h3>
          {customerTasks.length === 0 ? (
            <p style={{ color: 'var(--status-green)', fontSize: '0.9rem' }}>✓ Nothing pending on your side!</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {customerTasks.map(t => (
                <div key={t.id} style={{ background: 'var(--surface-elevated)', padding: '0.75rem', borderRadius: 'var(--radius-md)' }}>
                  <p style={{ fontWeight: 500, fontSize: '0.9rem' }}>{TRACK_LABELS[t.type]?.title || t.type}</p>
                  <p style={{ color: 'var(--text-tertiary)', fontSize: '0.8rem', marginTop: '0.25rem' }}>{TRACK_LABELS[t.type]?.customerDesc || ''}</p>
                </div>
              ))}
            </div>
          )}
        </div>
        
        <div className="card" style={{ borderTop: '3px solid var(--accent-primary)' }}>
          <h3 style={{ fontSize: '0.9rem', marginBottom: '0.75rem', color: 'var(--accent-primary)' }}>BiteSpeed Is Working On</h3>
          {bitespeedTasks.length === 0 ? (
            <p style={{ color: 'var(--status-green)', fontSize: '0.9rem' }}>✓ All done on our side!</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {bitespeedTasks.map(t => (
                <div key={t.id} style={{ background: 'var(--surface-elevated)', padding: '0.75rem', borderRadius: 'var(--radius-md)' }}>
                  <p style={{ fontWeight: 500, fontSize: '0.9rem' }}>{TRACK_LABELS[t.type]?.title || t.type}</p>
                  <p style={{ color: 'var(--text-tertiary)', fontSize: '0.8rem', marginTop: '0.25rem' }}>{TRACK_LABELS[t.type]?.bsDesc || ''}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Ask a question */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <h3 style={{ fontSize: '0.9rem', marginBottom: '0.75rem' }}>💬 Ask a Question</h3>
        <form action={askQuestionWithId}>
          <textarea 
            name="question" 
            className="form-input" 
            rows={3} 
            placeholder="Type your question here. Your Onboarding Manager will see it immediately."
            required
          />
          <button type="submit" className="btn-primary" style={{ marginTop: '0.75rem', width: '100%' }}>Send</button>
        </form>
      </div>
      
      {/* Recent messages */}
      {customerUpdates.length > 0 && (
        <div>
          <h3 style={{ fontSize: '0.9rem', marginBottom: '0.75rem', color: 'var(--text-secondary)' }}>Your Recent Messages</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {customerUpdates.map(log => (
              <div key={log.id} style={{ background: 'var(--surface-elevated)', padding: '0.75rem 1rem', borderRadius: 'var(--radius-md)', borderLeft: '3px solid var(--accent-primary)' }}>
                <p style={{ color: 'var(--text-tertiary)', fontSize: '0.7rem', marginBottom: '0.25rem' }}>
                  {new Date(log.created_at).toLocaleString()}
                </p>
                <p style={{ fontSize: '0.9rem' }}>{log.text}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
