import { prisma } from '@/lib/db';
import { computeStage, computeSlaStatus, computeRiskScore, computeEscalationTier, computePriorityScore, getTrialDay } from '@/lib/coreLogic';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function OMDashboard() {
  const omEmail = 'suhasini@bitespeed.co';
  
  const user = await prisma.user.findUnique({ where: { email: omEmail } });
  if (!user) return <div className="container"><h1>OM not found</h1></div>;

  const allOms = await prisma.user.findMany({ where: { role: 'om' } });

  const accounts = await prisma.account.findMany({
    where: { om_id: user.id },
    include: { tracks: true, escalations: true, updateLogs: { orderBy: { created_at: 'desc' }, take: 1 } }
  });

  const enrichedAccounts = accounts.map(acc => {
    const stage = computeStage(acc.conversion_status, acc.trial_start_date, acc.initial_plan_value_inr);
    const sla = computeSlaStatus(acc.tracks, acc.trial_start_date);
    const risk = computeRiskScore(acc, sla.status);
    const { tier, softFlag } = computeEscalationTier(stage, acc.last_customer_update_date, sla.status);
    const { score: priorityScore, level: priorityLevel } = computePriorityScore(risk.label, tier, 0);
    const trialDay = getTrialDay(acc.trial_start_date);
    const daysSinceUpdate = acc.last_customer_update_date
      ? Math.floor((new Date().getTime() - new Date(acc.last_customer_update_date).getTime()) / (1000 * 60 * 60 * 24))
      : null;

    // Next milestone
    const trackOrder = ['dns', 'migration', 'chatbot', 'warmup'];
    const nextMilestone = trackOrder
      .map(type => acc.tracks.find(t => t.type === type))
      .find(t => t && t.status !== 'complete' && t.status !== 'not_applicable');

    return { ...acc, stage, slaStatus: sla.status, riskLabel: risk.label, escalationTier: tier, softFlag, priorityScore, priorityLevel, trialDay, daysSinceUpdate, nextMilestone };
  });

  enrichedAccounts.sort((a, b) => b.priorityScore - a.priorityScore);

  const active = enrichedAccounts.filter(a => !['Lost', 'Stalled'].includes(a.conversion_status));
  const closed = enrichedAccounts.filter(a => ['Lost', 'Stalled'].includes(a.conversion_status));
  const activeWithRevenue = active.filter(a => a.revenue_generated_during_trial_inr > 0 && a.conversion_status !== 'Converted').length;
  const activeTrial = active.filter(a => a.conversion_status !== 'Converted');
  const countTier2 = enrichedAccounts.filter(a => a.escalationTier === 2).length;
  const countSoftFlagged = enrichedAccounts.filter(a => a.softFlag).length;
  const countRed = enrichedAccounts.filter(a => a.riskLabel === 'Red').length;

  return (
    <div className="container page-transition-enter">
      <div className="header">
        <div>
          <h1 className="header-title">{user.name}&apos;s Queue</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>{active.length} active accounts · {enrichedAccounts.length} total</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <a href="/api/export?view=accounts" className="btn-primary" style={{ background: 'var(--surface-elevated)', color: 'var(--accent-secondary)', border: '1px solid rgba(16, 185, 129, 0.3)' }}>↓ Export CSV</a>
          <Link href="/intake" className="btn-primary">+ New Account</Link>
          <Link href="/review" className="btn-primary" style={{ background: 'var(--surface-elevated)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }}>Weekly Review</Link>
          <Link href="/" className="btn-primary" style={{ background: 'var(--surface-elevated)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }}>Switch Role</Link>
        </div>
      </div>

      {/* Metrics strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '2rem' }}>
        <div className="card" style={{ padding: '1rem', textAlign: 'center' }}>
          <p style={{ color: 'var(--text-tertiary)', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Trials with Revenue</p>
          <p style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--status-green)' }}>
            {activeTrial.length > 0 ? Math.round((activeWithRevenue / activeTrial.length) * 100) : 0}%
          </p>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>{activeWithRevenue}/{activeTrial.length} active trials</p>
        </div>
        <div className="card" style={{ padding: '1rem', textAlign: 'center' }}>
          <p style={{ color: 'var(--text-tertiary)', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Red Risk</p>
          <p style={{ fontSize: '1.75rem', fontWeight: 700, color: countRed > 0 ? 'var(--status-red)' : 'var(--status-green)' }}>{countRed}</p>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>accounts at high risk</p>
        </div>
        <div className="card" style={{ padding: '1rem', textAlign: 'center' }}>
          <p style={{ color: 'var(--text-tertiary)', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Tier 2 Escalations</p>
          <p style={{ fontSize: '1.75rem', fontWeight: 700, color: countTier2 > 0 ? 'var(--status-red)' : 'var(--status-green)' }}>{countTier2}</p>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>need immediate action</p>
        </div>
        <div className="card" style={{ padding: '1rem', textAlign: 'center' }}>
          <p style={{ color: 'var(--text-tertiary)', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Comms Overdue</p>
          <p style={{ fontSize: '1.75rem', fontWeight: 700, color: countSoftFlagged > 0 ? 'var(--status-amber)' : 'var(--status-green)' }}>{countSoftFlagged}</p>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>past soft flag threshold</p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', alignItems: 'baseline' }}>
        <h2 style={{ margin: 0 }}>Priority Queue</h2>
        <p style={{ color: 'var(--text-tertiary)', fontSize: '0.8rem', margin: 0 }}>
          Sorted by urgency: P1 (Critical) → P5 (Standard).
        </p>
      </div>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {active.map((acc, i) => (
          <Link key={acc.id} href={`/account/${acc.id}`} className="card" style={{
            display: 'grid', gridTemplateColumns: '40px 1fr 200px 120px', alignItems: 'center', gap: '1rem',
            textDecoration: 'none', padding: '1rem',
            borderLeft: `4px solid ${acc.riskLabel === 'Red' ? 'var(--status-red)' : acc.riskLabel === 'Amber' ? 'var(--status-amber)' : 'var(--status-green)'}`,
          }}>
            {/* Rank */}
            <div style={{ textAlign: 'center' }}>
              <span style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-tertiary)' }}>#{i + 1}</span>
            </div>

            {/* Brand + status */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                <h3 style={{ color: 'var(--text-primary)', margin: 0, fontSize: '1rem' }}>{acc.brand_name}</h3>
                <span className={`badge ${acc.riskLabel.toLowerCase()}`} style={{ fontSize: '0.65rem' }}>{acc.riskLabel}</span>
                {acc.escalationTier === 2 && <span className="badge red" style={{ fontSize: '0.65rem' }}>T2</span>}
                {acc.softFlag && <span className="badge amber" style={{ fontSize: '0.65rem' }}>⚠</span>}
                {acc.slaStatus !== 'On Track' && <span className={`badge ${acc.slaStatus === 'Breached' ? 'red' : 'amber'}`} style={{ fontSize: '0.65rem' }}>SLA</span>}
              </div>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                {acc.plan_stack} · {acc.stage}
              </p>
            </div>

            {/* Next milestone + update */}
            <div style={{ textAlign: 'right' }}>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-primary)', textTransform: 'capitalize' }}>
                {acc.nextMilestone ? `→ ${acc.nextMilestone.type}` : '✅ All tracks done'}
              </p>
              <p style={{ fontSize: '0.75rem', color: acc.daysSinceUpdate !== null && acc.daysSinceUpdate >= 3 ? 'var(--status-red)' : 'var(--text-tertiary)' }}>
                {acc.daysSinceUpdate !== null ? `Updated ${acc.daysSinceUpdate}d ago` : 'No updates'}
              </p>
            </div>

            {/* Priority score */}
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: '1.5rem', fontWeight: 700, color: acc.priorityLevel === 'P1' || acc.priorityLevel === 'P2' ? 'var(--status-red)' : acc.priorityLevel === 'P3' ? 'var(--status-amber)' : 'var(--accent-primary)' }}>{acc.priorityLevel}</p>
              <p style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>Priority</p>
            </div>
          </Link>
        ))}
      </div>

      {/* Closed */}
      {closed.length > 0 && (
        <>
          <h2 style={{ margin: '2rem 0 1rem', color: 'var(--text-tertiary)' }}>Closed ({closed.length})</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', opacity: 0.6 }}>
            {closed.map(acc => (
              <Link key={acc.id} href={`/account/${acc.id}`} className="card" style={{ padding: '0.75rem 1rem', display: 'flex', justifyContent: 'space-between', textDecoration: 'none' }}>
                <span style={{ color: 'var(--text-secondary)' }}>{acc.brand_name}</span>
                <span style={{ color: 'var(--text-tertiary)', fontSize: '0.85rem' }}>{acc.conversion_status}</span>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
