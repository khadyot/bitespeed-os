import { prisma } from '@/lib/db';
import { computeSlaStatus, getTrialDay } from '@/lib/coreLogic';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function WeeklyReview() {
  const accounts = await prisma.account.findMany({
    include: { tracks: true, om: true }
  });

  const totals = { total: accounts.length, converted: 0, activeWithRevenue: 0, breached: 0, lost: 0, stalled: 0, activeTrial: 0 };

  const planStats: Record<string, { total: number, converted: number, revenueAccounts: number, breached: number, totalRevenue: number }> = {};
  const omStats: Record<string, { total: number, converted: number, revenueAccounts: number, breached: number, name: string, redCount: number }> = {};

  accounts.forEach(acc => {
    const isConverted = acc.conversion_status === 'Converted';
    const isLost = acc.conversion_status === 'Lost';
    const isStalled = acc.conversion_status === 'Stalled';
    const hasRevenue = acc.revenue_generated_during_trial_inr > 0;
    const sla = computeSlaStatus(acc.tracks, acc.trial_start_date);
    const isBreached = sla.status === 'Breached';
    const isActive = !isConverted && !isLost && !isStalled;

    if (isConverted) totals.converted++;
    if (isLost) totals.lost++;
    if (isStalled) totals.stalled++;
    if (isActive) totals.activeTrial++;
    if (hasRevenue && isActive) totals.activeWithRevenue++;
    if (isBreached) totals.breached++;

    const plan = acc.plan_stack;
    if (!planStats[plan]) planStats[plan] = { total: 0, converted: 0, revenueAccounts: 0, breached: 0, totalRevenue: 0 };
    planStats[plan].total++;
    if (isConverted) planStats[plan].converted++;
    if (hasRevenue) planStats[plan].revenueAccounts++;
    if (isBreached) planStats[plan].breached++;
    planStats[plan].totalRevenue += acc.revenue_generated_during_trial_inr;

    if (acc.om) {
      const oid = acc.om_id!;
      if (!omStats[oid]) omStats[oid] = { name: acc.om.name, total: 0, converted: 0, revenueAccounts: 0, breached: 0, redCount: 0 };
      omStats[oid].total++;
      if (isConverted) omStats[oid].converted++;
      if (hasRevenue && isActive) omStats[oid].revenueAccounts++;
      if (isBreached) omStats[oid].breached++;
    }
  });

  const baseOmniConv = planStats['Omnichannel'] ? (planStats['Omnichannel'].converted / planStats['Omnichannel'].total) * 100 : 0;
  const aiOmniConv = planStats['Omnichannel + AI'] ? (planStats['Omnichannel + AI'].converted / planStats['Omnichannel + AI'].total) * 100 : 0;
  const gap = (aiOmniConv - baseOmniConv).toFixed(1);
  const conversionRate = totals.total > 0 ? Math.round((totals.converted / totals.total) * 100) : 0;
  const revenueRate = totals.activeTrial > 0 ? Math.round((totals.activeWithRevenue / totals.activeTrial) * 100) : 0;
  const breachRate = totals.total > 0 ? Math.round((totals.breached / totals.total) * 100) : 0;

  return (
    <div className="container page-transition-enter">
      <div className="header">
        <div>
          <h1 className="header-title">Weekly Review</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Performance snapshot across all accounts</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <a href="/api/export?view=review" className="btn-primary" style={{ background: 'var(--surface-elevated)', color: 'var(--accent-secondary)', border: '1px solid rgba(16, 185, 129, 0.3)' }}>↓ Export CSV</a>
          <Link href="/backstop" className="btn-primary" style={{ background: 'var(--surface-elevated)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }}>Escalations</Link>
          <Link href="/" className="btn-primary" style={{ background: 'var(--surface-elevated)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }}>Switch Role</Link>
        </div>
      </div>

      {/* Open Question banner */}
      <div className="card" style={{ marginBottom: '2rem', borderLeft: '4px solid var(--status-amber)', background: 'rgba(245, 158, 11, 0.05)' }}>
        <h3 style={{ color: 'var(--status-amber)', marginBottom: '0.5rem', fontSize: '1rem' }}>⚠ Open Question: Omnichannel vs Omnichannel + AI Conversion Gap</h3>
        <p style={{ color: 'var(--text-primary)', fontSize: '0.9rem', marginBottom: '0.5rem' }}>
          Base Omnichannel converts at <strong>{baseOmniConv.toFixed(1)}%</strong>, while Omnichannel + AI converts at <strong>{aiOmniConv.toFixed(1)}%</strong> — a <strong>{gap}pp</strong> difference.
        </p>
        <p style={{ color: 'var(--text-tertiary)', fontSize: '0.8rem' }}>
          This gap is surfaced from live data. It may reflect that the partner-owned chatbot track adds delay, or that Omnichannel + AI attracts a different customer profile. This is flagged as an open question, not a resolved finding — investigate before drawing conclusions.
        </p>
      </div>

      {/* Headline metrics with explanations */}
      <h2 style={{ marginBottom: '0.25rem' }}>Headline Metrics</h2>
      <p style={{ color: 'var(--text-tertiary)', fontSize: '0.8rem', marginBottom: '1rem' }}>What the CS team should be tracking week over week.</p>
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '2.5rem' }}>
        <div className="card" style={{ padding: '1.25rem' }}>
          <p style={{ color: 'var(--text-tertiary)', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>Conversion Rate</p>
          <p style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--status-green)' }}>{conversionRate}%</p>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: '0.5rem' }}>{totals.converted} of {totals.total} accounts have converted to paid. Measures how well onboarding leads to revenue.</p>
        </div>
        <div className="card" style={{ padding: '1.25rem' }}>
          <p style={{ color: 'var(--text-tertiary)', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>Active Trials w/ Revenue</p>
          <p style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--accent-primary)' }}>{revenueRate}%</p>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: '0.5rem' }}>{totals.activeWithRevenue} of {totals.activeTrial} active trials are generating orders. Leading indicator — revenue during trial predicts conversion.</p>
        </div>
        <div className="card" style={{ padding: '1.25rem' }}>
          <p style={{ color: 'var(--text-tertiary)', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>SLA Breach Rate</p>
          <p style={{ fontSize: '2rem', fontWeight: 700, color: breachRate > 0 ? 'var(--status-red)' : 'var(--status-green)' }}>{breachRate}%</p>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: '0.5rem' }}>{totals.breached} accounts have at least one track past its SLA threshold. Measures operational responsiveness.</p>
        </div>
        <div className="card" style={{ padding: '1.25rem' }}>
          <p style={{ color: 'var(--text-tertiary)', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>Lost / Stalled</p>
          <p style={{ fontSize: '2rem', fontWeight: 700, color: (totals.lost + totals.stalled) > 0 ? 'var(--status-red)' : 'var(--status-green)' }}>{totals.lost + totals.stalled}</p>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: '0.5rem' }}>{totals.lost} lost, {totals.stalled} stalled. Accounts that dropped off or went dark.</p>
        </div>
      </div>

      {/* Rollup tables */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
        <div className="card">
          <h2 style={{ fontSize: '1.1rem', marginBottom: '0.25rem' }}>By Plan</h2>
          <p style={{ color: 'var(--text-tertiary)', fontSize: '0.75rem', marginBottom: '1rem' }}>How each plan type is performing. Use this to spot if certain plan types consistently underperform.</p>
          <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-tertiary)', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                <th style={{ padding: '0.5rem 0', fontWeight: 500 }}>Plan</th>
                <th style={{ fontWeight: 500, textAlign: 'center' }}>Count</th>
                <th style={{ fontWeight: 500, textAlign: 'center' }}>Conv %</th>
                <th style={{ fontWeight: 500, textAlign: 'center' }}>Rev %</th>
                <th style={{ fontWeight: 500, textAlign: 'center' }}>Breach %</th>
                <th style={{ fontWeight: 500, textAlign: 'right' }}>Revenue</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(planStats).map(([plan, stats]) => (
                <tr key={plan} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <td style={{ padding: '0.75rem 0', color: 'var(--text-primary)', fontWeight: 500 }}>{plan}</td>
                  <td style={{ textAlign: 'center' }}>{stats.total}</td>
                  <td style={{ textAlign: 'center', color: 'var(--status-green)' }}>{Math.round((stats.converted / stats.total) * 100)}%</td>
                  <td style={{ textAlign: 'center', color: 'var(--accent-primary)' }}>{Math.round((stats.revenueAccounts / stats.total) * 100)}%</td>
                  <td style={{ textAlign: 'center', color: stats.breached > 0 ? 'var(--status-red)' : 'var(--text-tertiary)' }}>{Math.round((stats.breached / stats.total) * 100)}%</td>
                  <td style={{ textAlign: 'right', color: 'var(--text-primary)' }}>₹{stats.totalRevenue.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="card">
          <h2 style={{ fontSize: '1.1rem', marginBottom: '0.25rem' }}>By OM</h2>
          <p style={{ color: 'var(--text-tertiary)', fontSize: '0.75rem', marginBottom: '1rem' }}>Individual OM performance. Use this to balance load and identify capacity issues.</p>
          <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-tertiary)', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                <th style={{ padding: '0.5rem 0', fontWeight: 500 }}>OM</th>
                <th style={{ fontWeight: 500, textAlign: 'center' }}>Load</th>
                <th style={{ fontWeight: 500, textAlign: 'center' }}>Conv %</th>
                <th style={{ fontWeight: 500, textAlign: 'center' }}>Rev Trials</th>
                <th style={{ fontWeight: 500, textAlign: 'center' }}>Breach %</th>
              </tr>
            </thead>
            <tbody>
              {Object.values(omStats).sort((a, b) => b.total - a.total).map((stats) => (
                <tr key={stats.name} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <td style={{ padding: '0.75rem 0', color: 'var(--text-primary)', fontWeight: 500 }}>{stats.name}</td>
                  <td style={{ textAlign: 'center' }}>{stats.total}/25</td>
                  <td style={{ textAlign: 'center', color: 'var(--status-green)' }}>{stats.total > 0 ? Math.round((stats.converted / stats.total) * 100) : 0}%</td>
                  <td style={{ textAlign: 'center', color: 'var(--accent-primary)' }}>{stats.revenueAccounts}</td>
                  <td style={{ textAlign: 'center', color: stats.breached > 0 ? 'var(--status-red)' : 'var(--text-tertiary)' }}>{stats.total > 0 ? Math.round((stats.breached / stats.total) * 100) : 0}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
