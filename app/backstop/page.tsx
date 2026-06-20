import { prisma } from '@/lib/db';
import { computeStage, computeSlaStatus, computePriorityScore, computeRiskScore, computeEscalationTier } from '@/lib/coreLogic';
import Link from 'next/link';
import { acknowledgeEscalation, resolveEscalation } from '@/app/actions';

export const dynamic = 'force-dynamic';

export default async function BackstopDashboard() {
  const reviewerEmail = 'reviewer@bitespeed.co';
  const user = await prisma.user.findUnique({ where: { email: reviewerEmail } });
  if (!user) return <div className="container"><h1>Reviewer not found</h1></div>;

  const accounts = await prisma.account.findMany({
    include: { tracks: true, escalations: { orderBy: { opened_at: 'desc' } }, om: true }
  });

  const activeEscalations: any[] = [];
  const accountsWithEscalations: any[] = [];

  accounts.forEach(acc => {
    const stage = computeStage(acc.conversion_status, acc.trial_start_date, acc.initial_plan_value_inr);
    const sla = computeSlaStatus(acc.tracks, acc.trial_start_date);
    const risk = computeRiskScore(acc, sla.status);
    const { tier } = computeEscalationTier(stage, acc.last_customer_update_date, sla.status);
    const { score: priorityScore, level: priorityLevel } = computePriorityScore(risk.label, tier, 0);

    const hasEscalations = acc.escalations.some(e => !e.resolved_at);

    if (hasEscalations) {
      acc.escalations.forEach(esc => {
        if (!esc.resolved_at) {
          activeEscalations.push({
            ...esc,
            account: acc,
            omName: acc.om?.name,
            accountRisk: risk.label,
            priorityLevel
          });
        }
      });
      accountsWithEscalations.push({ ...acc, stage, escalationTier: tier, priorityScore, priorityLevel, accountRisk: risk.label });
    }
  });

  accountsWithEscalations.sort((a, b) => b.priorityScore - a.priorityScore);
  activeEscalations.sort((a, b) => b.tier - a.tier || new Date(a.opened_at).getTime() - new Date(b.opened_at).getTime());

  const unacknowledgedCount = activeEscalations.filter(e => !e.acknowledged_at).length;
  const tier2Count = activeEscalations.filter(e => e.tier >= 2).length;

  return (
    <div className="container page-transition-enter">
      <div className="header">
        <div>
          <h1 className="header-title">Backstop Reviewer</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Global escalation and risk monitor</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <Link href="/review" className="btn-primary" style={{ background: 'var(--surface-elevated)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }}>Weekly Review</Link>
          <Link href="/" className="btn-primary" style={{ background: 'var(--surface-elevated)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }}>Switch Role</Link>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '2rem' }}>
        <div className="card" style={{ padding: '1.25rem', textAlign: 'center' }}>
          <p style={{ color: 'var(--text-tertiary)', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Active Escalations</p>
          <p style={{ fontSize: '2rem', fontWeight: 700, color: activeEscalations.length > 0 ? 'var(--status-amber)' : 'var(--status-green)' }}>{activeEscalations.length}</p>
        </div>
        <div className="card" style={{ padding: '1.25rem', textAlign: 'center' }}>
          <p style={{ color: 'var(--text-tertiary)', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Unacknowledged</p>
          <p style={{ fontSize: '2rem', fontWeight: 700, color: unacknowledgedCount > 0 ? 'var(--status-red)' : 'var(--status-green)' }}>{unacknowledgedCount}</p>
        </div>
        <div className="card" style={{ padding: '1.25rem', textAlign: 'center' }}>
          <p style={{ color: 'var(--text-tertiary)', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Tier 2+ (Critical)</p>
          <p style={{ fontSize: '2rem', fontWeight: 700, color: tier2Count > 0 ? 'var(--status-red)' : 'var(--status-green)' }}>{tier2Count}</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '2rem' }}>
        <div>
          <h2 style={{ marginBottom: '1rem', fontSize: '1.25rem' }}>Active Escalation Feed</h2>
          
          {activeEscalations.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '4rem 2rem', color: 'var(--text-tertiary)', background: 'var(--surface-base)', borderRadius: 'var(--radius-md)', border: '1px dashed var(--border-color)' }}>
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🎉</div>
              <h3 style={{ color: 'var(--text-primary)', marginBottom: '0.5rem' }}>Inbox Zero</h3>
              <p>No active escalations! The CS team is crushing it.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {activeEscalations.map(esc => {
                const ackAction = acknowledgeEscalation.bind(null, esc.id, user.id);
                const resolveAction = resolveEscalation.bind(null, esc.id);
                
                return (
                  <div key={esc.id} className="card" style={{ borderLeft: `4px solid ${esc.tier >= 2 ? 'var(--status-red)' : 'var(--status-amber)'}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                          <Link href={`/account/${esc.account_id}`} style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: '1.1rem', textDecoration: 'none' }}>{esc.account.brand_name}</Link>
                          <span className="badge red">Tier {esc.tier}</span>
                          <span className="badge" style={{ textTransform: 'capitalize' }}>{esc.blocker_type} Blocker</span>
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>{esc.priorityLevel}</span>
                        </div>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>OM: {esc.omName || 'Unassigned'} · Opened {new Date(esc.opened_at).toLocaleDateString()}</p>
                      </div>
                    </div>
                    
                    <div style={{ background: 'var(--surface-base)', padding: '1rem', borderRadius: 'var(--radius-sm)', marginBottom: '1rem', fontSize: '0.95rem' }}>
                      "{esc.reason}"
                    </div>
                    
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.8rem', color: esc.acknowledged_at ? 'var(--status-green)' : 'var(--status-amber)', fontWeight: 500 }}>
                        {esc.acknowledged_at ? '✓ Acknowledged' : '⚠ Action Required'}
                      </span>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        {!esc.acknowledged_at && (
                          <form action={ackAction}>
                            <button type="submit" className="btn-primary" style={{ background: 'var(--surface-elevated)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', padding: '0.5rem 1rem' }}>
                              Acknowledge
                            </button>
                          </form>
                        )}
                        <form action={resolveAction}>
                          <button type="submit" className="btn-primary" style={{ padding: '0.5rem 1rem' }}>
                            Mark Resolved
                          </button>
                        </form>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div>
          <h2 style={{ marginBottom: '1rem', fontSize: '1.25rem' }}>Accounts at Risk</h2>
          {accountsWithEscalations.length === 0 ? (
            <div className="card" style={{ padding: '2rem 1rem', textAlign: 'center', color: 'var(--text-tertiary)' }}>
              All accounts are healthy.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {accountsWithEscalations.map(acc => (
                <Link key={acc.id} href={`/account/${acc.id}`} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', textDecoration: 'none' }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '0.95rem', color: 'var(--text-primary)' }}>{acc.brand_name}</h3>
                    <p style={{ color: 'var(--text-tertiary)', fontSize: '0.75rem', marginTop: '0.25rem' }}>{acc.om?.name}</p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontWeight: 700, color: acc.priorityLevel === 'P1' || acc.priorityLevel === 'P2' ? 'var(--status-red)' : acc.priorityLevel === 'P3' ? 'var(--status-amber)' : 'var(--text-primary)', fontSize: '0.9rem' }}>{acc.priorityLevel}</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
