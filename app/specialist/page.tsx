import { prisma } from '@/lib/db';
import { computeStage, computeSlaStatus, computePriorityScore, computeRiskScore, computeEscalationTier, getTrialDay } from '@/lib/coreLogic';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function SpecialistDashboard() {
  const specialistEmail = 'tech@bitespeed.co';
  const user = await prisma.user.findUnique({ where: { email: specialistEmail } });
  if (!user) return <div className="container"><h1>Specialist not found</h1></div>;

  const accounts = await prisma.account.findMany({
    where: { specialist_id: user.id },
    include: { tracks: true, om: true }
  });

  type TrackItem = {
    id: string;
    type: string;
    status: string;
    owner_type: string;
    due_day: number;
    last_updated_at: Date;
    brandName: string;
    accountId: string;
    omName: string;
    trialDay: number;
    priorityScore: number;
    priorityLevel: string;
    riskLabel: string;
    daysSinceTrackUpdate: number;
    isMine: boolean;
  };

  const allTracks: TrackItem[] = [];

  accounts.forEach(acc => {
    if (['Lost', 'Stalled'].includes(acc.conversion_status)) return;

    const stage = computeStage(acc.conversion_status, acc.trial_start_date, acc.initial_plan_value_inr);
    const sla = computeSlaStatus(acc.tracks, acc.trial_start_date);
    const risk = computeRiskScore(acc, sla.status);
    const { tier } = computeEscalationTier(stage, acc.last_customer_update_date, sla.status);
    const { score: priorityScore, level: priorityLevel } = computePriorityScore(risk.label, tier, 0);
    const trialDay = getTrialDay(acc.trial_start_date);

    acc.tracks.forEach(track => {
      if (track.status === 'complete' || track.status === 'not_applicable') return;
      const daysSinceTrackUpdate = Math.max(0, Math.floor((new Date().getTime() - new Date(track.last_updated_at).getTime()) / (1000 * 60 * 60 * 24)));

      allTracks.push({
        id: track.id,
        type: track.type,
        status: track.status,
        owner_type: track.owner_type,
        due_day: track.due_day,
        last_updated_at: track.last_updated_at,
        brandName: acc.brand_name,
        accountId: acc.id,
        omName: acc.om?.name || '—',
        trialDay,
        priorityScore,
        priorityLevel,
        riskLabel: risk.label,
        daysSinceTrackUpdate,
        isMine: track.owner_type === 'Specialist' || track.owner_type === 'BiteSpeed',
      });
    });
  });

  allTracks.sort((a, b) => b.priorityScore - a.priorityScore || b.daysSinceTrackUpdate - a.daysSinceTrackUpdate);

  const myTracks = allTracks.filter(t => t.isMine);
  const watchTracks = allTracks.filter(t => !t.isMine);

  const STATUS_ICON: Record<string, string> = {
    not_started: '⏳',
    active: '🔄',
    blocked: '🚫',
  };

  const trackTypes = ['dns', 'migration', 'chatbot', 'warmup'];

  function renderTrackTable(tracks: TrackItem[], title: string, subtitle: string) {
    return (
      <>
        <h2 style={{ marginBottom: '0.25rem' }}>{title}</h2>
        <p style={{ color: 'var(--text-tertiary)', fontSize: '0.8rem', marginBottom: '1rem' }}>{subtitle}</p>
        {tracks.length === 0 ? (
          <p style={{ color: 'var(--text-secondary)', padding: '1rem' }}>Nothing here right now.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '0 4px' }}>
              <thead>
                <tr style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  <th style={{ textAlign: 'left', padding: '0.5rem 0.75rem', fontWeight: 500 }}>Brand</th>
                  <th style={{ textAlign: 'left', padding: '0.5rem 0.75rem', fontWeight: 500 }}>Track</th>
                  <th style={{ textAlign: 'left', padding: '0.5rem 0.75rem', fontWeight: 500 }}>Status</th>
                  <th style={{ textAlign: 'left', padding: '0.5rem 0.75rem', fontWeight: 500 }}>Owner</th>
                  <th style={{ textAlign: 'center', padding: '0.5rem 0.75rem', fontWeight: 500 }}>Due Day</th>
                  <th style={{ textAlign: 'center', padding: '0.5rem 0.75rem', fontWeight: 500 }}>Trial Day</th>
                  <th style={{ textAlign: 'center', padding: '0.5rem 0.75rem', fontWeight: 500 }}>Stale</th>
                  <th style={{ textAlign: 'left', padding: '0.5rem 0.75rem', fontWeight: 500 }}>OM</th>
                  <th style={{ textAlign: 'center', padding: '0.5rem 0.75rem', fontWeight: 500 }}>Risk</th>
                  <th style={{ textAlign: 'center', padding: '0.5rem 0.75rem', fontWeight: 500 }}>Priority</th>
                </tr>
              </thead>
              <tbody>
                {tracks.map(track => (
                  <tr key={track.id} style={{ background: 'var(--surface-base)', borderRadius: 'var(--radius-md)' }}>
                    <td style={{ padding: '0.75rem', borderLeft: `3px solid ${track.riskLabel === 'Red' ? 'var(--status-red)' : track.riskLabel === 'Amber' ? 'var(--status-amber)' : 'var(--status-green)'}` }}>
                      <Link href={`/account/${track.accountId}`} style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{track.brandName}</Link>
                    </td>
                    <td style={{ padding: '0.75rem', textTransform: 'capitalize', fontWeight: 500 }}>{track.type}</td>
                    <td style={{ padding: '0.75rem' }}>
                      <span style={{ color: track.status === 'blocked' ? 'var(--status-red)' : track.status === 'active' ? 'var(--accent-primary)' : 'var(--text-tertiary)' }}>
                        {STATUS_ICON[track.status] || ''} {track.status}
                      </span>
                    </td>
                    <td style={{ padding: '0.75rem', fontSize: '0.85rem' }}>{track.owner_type}</td>
                    <td style={{ padding: '0.75rem', textAlign: 'center', fontSize: '0.85rem' }}>Day {track.due_day}</td>
                    <td style={{ padding: '0.75rem', textAlign: 'center', fontSize: '0.85rem' }}>Day {track.trialDay}</td>
                    <td style={{ padding: '0.75rem', textAlign: 'center', color: track.daysSinceTrackUpdate >= 2 ? 'var(--status-red)' : 'var(--text-tertiary)', fontWeight: track.daysSinceTrackUpdate >= 2 ? 600 : 400, fontSize: '0.85rem' }}>
                      {track.daysSinceTrackUpdate}d
                    </td>
                    <td style={{ padding: '0.75rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{track.omName}</td>
                    <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                      <span className={`badge ${track.riskLabel.toLowerCase()}`} style={{ fontSize: '0.65rem' }}>{track.riskLabel}</span>
                    </td>
                    <td style={{ padding: '0.75rem', textAlign: 'center', fontWeight: 700, color: track.priorityLevel === 'P1' || track.priorityLevel === 'P2' ? 'var(--status-red)' : track.priorityLevel === 'P3' ? 'var(--status-amber)' : 'var(--accent-primary)' }}>{track.priorityLevel}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </>
    );
  }

  return (
    <div className="container page-transition-enter">
      <div className="header">
        <div>
          <h1 className="header-title">{user.name}&apos;s Track Queue</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>{myTracks.length} tracks owned by you · {watchTracks.length} waiting on others</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <a href="/api/export?view=tracks" className="btn-primary" style={{ background: 'var(--surface-elevated)', color: 'var(--accent-secondary)', border: '1px solid rgba(16, 185, 129, 0.3)' }}>↓ Export CSV</a>
          <Link href="/review" className="btn-primary" style={{ background: 'var(--surface-elevated)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }}>Weekly Review</Link>
          <Link href="/" className="btn-primary" style={{ background: 'var(--surface-elevated)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }}>Switch Role</Link>
        </div>
      </div>

      {/* Metric strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '2rem' }}>
        {trackTypes.map(type => {
          const count = myTracks.filter(t => t.type === type).length;
          const blockedCount = myTracks.filter(t => t.type === type && t.status === 'blocked').length;
          return (
            <div key={type} className="card" style={{ padding: '1rem', textAlign: 'center' }}>
              <p style={{ color: 'var(--text-tertiary)', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{type}</p>
              <p style={{ fontSize: '1.5rem', fontWeight: 700, color: count > 0 ? 'var(--text-primary)' : 'var(--text-tertiary)' }}>{count}</p>
              {blockedCount > 0 && <p style={{ fontSize: '0.75rem', color: 'var(--status-red)' }}>{blockedCount} blocked</p>}
            </div>
          );
        })}
      </div>

      {/* My tracks table */}
      <div style={{ marginBottom: '3rem' }}>
        {renderTrackTable(myTracks, '🔧 Your Tracks', 'Tracks where you (Specialist/BiteSpeed) are the owner. Sorted by account priority.')}
      </div>

      {/* Watch tracks */}
      <div style={{ opacity: 0.75 }}>
        {renderTrackTable(watchTracks, '👁 Watching', 'Tracks owned by Customer or Partner. You\'ll pick these up once ownership transfers.')}
      </div>
    </div>
  );
}
