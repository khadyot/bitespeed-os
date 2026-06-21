import { prisma } from '@/lib/db';
import { computeStage, computeSlaStatus, computePriorityScore, computeRiskScore, computeEscalationTier, getTrialDay } from '@/lib/coreLogic';
import { logUpdate, flagBlocker, updateTrackStatus, updateAccountFields, handoffToAM } from '@/app/actions';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

const TRACK_STATUS_LABEL: Record<string, string> = {
  not_started: '⏳ Not Started',
  active: '🔄 Active',
  blocked: '🚫 Blocked',
  complete: '✅ Complete',
  not_applicable: '— N/A',
};

const TRACK_STATUS_COLOR: Record<string, string> = {
  not_started: 'var(--text-tertiary)',
  active: 'var(--accent-primary)',
  blocked: 'var(--status-red)',
  complete: 'var(--status-green)',
};

export default async function AccountDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const account = await prisma.account.findUnique({
    where: { id },
    include: {
      tracks: true,
      om: true,
      specialist: true,
      updateLogs: { orderBy: { created_at: 'desc' }, take: 30 },
      escalations: { orderBy: { opened_at: 'desc' } }
    }
  });

  const ams = await prisma.user.findMany({ where: { role: 'account_manager' } });

  if (!account) return <div className="container"><h1>Account not found</h1></div>;

  const stage = computeStage(account.conversion_status, account.trial_start_date, account.initial_plan_value_inr);
  const sla = computeSlaStatus(account.tracks, account.trial_start_date);
  const risk = computeRiskScore(account, sla.status);
  const { tier, softFlag } = computeEscalationTier(stage, account.last_customer_update_date, sla.status);
  const { score: priorityScore, level: priorityLevel } = computePriorityScore(risk.label, tier, 0);
  const trialDay = getTrialDay(account.trial_start_date);
  const daysSinceUpdate = account.last_customer_update_date
    ? Math.floor((new Date().getTime() - new Date(account.last_customer_update_date).getTime()) / (1000 * 60 * 60 * 24))
    : null;

  const updateAccountAction = updateAccountFields.bind(null, account.id);
  const logUpdateAction = logUpdate.bind(null, account.id, account.om_id || '');
  const flagBlockerAction = flagBlocker.bind(null, account.id, account.om_id || '');

  // Next milestone: first non-complete, non-N/A track in order DNS → Migration → Chatbot → Warmup
  const trackOrder = ['dns', 'migration', 'chatbot', 'warmup'];
  const nextMilestone = trackOrder
    .map(type => account.tracks.find(t => t.type === type))
    .find(t => t && t.status !== 'complete' && t.status !== 'not_applicable');

  // Unique key forces React to re-mount forms after server action updates
  const formKey = `${account.conversion_status}-${account.revenue_generated_during_trial_inr}-${account.orders_attributed_during_trial}-${account.phone_number}-${account.account_manager_id}-${Date.now()}`;

  let nudgeMessage = `Hi ${account.brand_name} team,\n\nChecking in on your BiteSpeed onboarding. `;
  if (nextMilestone && nextMilestone.owner_type === 'Customer') {
    nudgeMessage += `It looks like we are waiting on you to complete the ${nextMilestone.type} step. Please let us know if you need any help!\n\n`;
  } else if (daysSinceUpdate !== null && softFlag) {
    nudgeMessage += `We haven't heard from you in a few days. Is everything going smoothly?\n\n`;
  } else {
    nudgeMessage += `Just keeping you in the loop that things are progressing well on our end.\n\n`;
  }
  nudgeMessage += `Thanks,\n${account.om?.name || 'Your BiteSpeed Team'}`;

  return (
    <div className="container page-transition-enter">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '1.5rem 0', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)' }}>
        <div>
          <Link href="/om" style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', display: 'inline-block', marginBottom: '0.5rem' }}>← Back to Dashboard</Link>
          <h1 style={{ margin: 0, fontSize: '1.75rem' }}>{account.brand_name}</h1>
          <p style={{ color: 'var(--text-secondary)', marginTop: '0.25rem' }}>{account.plan_stack} · {account.segment} · Day {trialDay} · Priority {priorityLevel}</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <span className={`badge ${risk.label.toLowerCase()}`}>{risk.label} Risk</span>
          <span className={`badge ${sla.status === 'On Track' ? 'green' : sla.status === 'Breached' ? 'red' : 'amber'}`}>SLA {sla.status}</span>
          {tier > 0 && <span className="badge red">Tier {tier}</span>}
          {softFlag && <span className="badge amber">⚠ Comms Flag</span>}
        </div>
      </div>

      {/* Status strip */}
      <div className="data-grid" style={{ marginBottom: '2rem', gridTemplateColumns: 'repeat(5, 1fr)' }}>
        <div className="card" style={{ padding: '1rem', textAlign: 'center' }}>
          <p style={{ color: 'var(--text-tertiary)', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Stage</p>
          <p style={{ fontWeight: 600, fontSize: '0.9rem', marginTop: '0.25rem' }}>{stage}</p>
        </div>
        <div className="card" style={{ padding: '1rem', textAlign: 'center' }}>
          <p style={{ color: 'var(--text-tertiary)', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Trial Revenue</p>
          <p style={{ fontWeight: 700, fontSize: '1.25rem', marginTop: '0.25rem', color: account.revenue_generated_during_trial_inr > 0 ? 'var(--status-green)' : 'var(--text-tertiary)' }}>₹{account.revenue_generated_during_trial_inr.toLocaleString()}</p>
        </div>
        <div className="card" style={{ padding: '1rem', textAlign: 'center' }}>
          <p style={{ color: 'var(--text-tertiary)', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Orders</p>
          <p style={{ fontWeight: 700, fontSize: '1.25rem', marginTop: '0.25rem' }}>{account.orders_attributed_during_trial}</p>
        </div>
        <div className="card" style={{ padding: '1rem', textAlign: 'center' }}>
          <p style={{ color: 'var(--text-tertiary)', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Next Milestone</p>
          <p style={{ fontWeight: 600, fontSize: '0.9rem', marginTop: '0.25rem', textTransform: 'capitalize' }}>{nextMilestone ? `${nextMilestone.type} (Day ${nextMilestone.due_day})` : 'All Complete'}</p>
        </div>
        <div className="card" style={{ padding: '1rem', textAlign: 'center' }}>
          <p style={{ color: 'var(--text-tertiary)', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Last Update</p>
          <p style={{ fontWeight: 600, fontSize: '0.9rem', marginTop: '0.25rem', color: daysSinceUpdate !== null && daysSinceUpdate >= 3 ? 'var(--status-red)' : 'var(--text-primary)' }}>{daysSinceUpdate !== null ? `${daysSinceUpdate}d ago` : 'Never'}</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
        {/* LEFT COLUMN */}
        <div>
          {/* Edit Account Fields */}
          <div className="card" style={{ marginBottom: '1.5rem' }}>
            <h2 style={{ fontSize: '1.1rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ color: 'var(--accent-primary)' }}>✏️</span> Edit Account
            </h2>
            <form action={updateAccountAction} key={formKey}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label className="form-label">Conversion Status</label>
                  <select name="conversion_status" defaultValue={account.conversion_status} className="form-select">
                    <option value="Not Converted">Not Converted</option>
                    <option value="Likely">Likely</option>
                    <option value="At Risk">At Risk</option>
                    <option value="Converted">Converted</option>
                    <option value="Lost">Lost</option>
                    <option value="Stalled">Stalled</option>
                  </select>
                </div>
                <div>
                  <label className="form-label">Plan Stack</label>
                  <select name="plan_stack" defaultValue={account.plan_stack} className="form-select">
                    <option value="Omnichannel">Omnichannel</option>
                    <option value="Omnichannel + AI">Omnichannel + AI</option>
                    <option value="Marketing Only">Marketing Only</option>
                    <option value="Support Only">Support Only</option>
                  </select>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label className="form-label">Trial Revenue (₹)</label>
                  <input type="number" name="revenue" defaultValue={account.revenue_generated_during_trial_inr} className="form-input" />
                </div>
                <div>
                  <label className="form-label">Orders Attributed</label>
                  <input type="number" name="orders" defaultValue={account.orders_attributed_during_trial} className="form-input" />
                </div>
                <div>
                  <label className="form-label">Plan Value (₹)</label>
                  <input type="number" name="initial_plan_value_inr" defaultValue={account.initial_plan_value_inr} className="form-input" />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label className="form-label">Segment</label>
                  <select name="segment" defaultValue={account.segment} className="form-select">
                    <option value="Enterprise">Enterprise</option>
                    <option value="Mid Market">Mid Market</option>
                    <option value="SMB">SMB</option>
                  </select>
                </div>
                <div>
                  <label className="form-label">Phone Number (WhatsApp)</label>
                  <input type="text" name="phone_number" defaultValue={account.phone_number || ''} className="form-input" placeholder="+1234567890" />
                </div>
              </div>
              <button type="submit" className="btn-primary" style={{ width: '100%' }}>Save Account Changes</button>
            </form>
          </div>

          {/* Tracks */}
          <h2 style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>Dependency Tracks</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
            {trackOrder.map(type => {
              const track = account.tracks.find(t => t.type === type);
              if (!track || track.status === 'not_applicable') return null;
              const updateTrackAction = updateTrackStatus.bind(null, track.id, account.id);
              
              return (
                <div key={track.id} className="card" style={{ padding: '1rem', borderLeft: `3px solid ${TRACK_STATUS_COLOR[track.status] || 'var(--border-color)'}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                    <h3 style={{ textTransform: 'capitalize', fontSize: '1rem', margin: 0 }}>{track.type}</h3>
                    <span style={{ color: TRACK_STATUS_COLOR[track.status], fontSize: '0.85rem', fontWeight: 600 }}>
                      {TRACK_STATUS_LABEL[track.status]}
                    </span>
                  </div>
                  
                  <form action={updateTrackAction} key={`${track.id}-${track.status}-${track.owner_type}`} style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end' }}>
                    <div style={{ flex: 1 }}>
                      <label className="form-label" style={{ fontSize: '0.75rem' }}>Status</label>
                      <select name="status" defaultValue={track.status} className="form-select" style={{ fontSize: '0.85rem' }}>
                        <option value="not_started">Not Started</option>
                        <option value="active">Active</option>
                        <option value="blocked">Blocked</option>
                        <option value="complete">Complete</option>
                      </select>
                    </div>
                    <div style={{ flex: 1 }}>
                      <label className="form-label" style={{ fontSize: '0.75rem' }}>Owner</label>
                      <select name="owner_type" defaultValue={track.owner_type} className="form-select" style={{ fontSize: '0.85rem' }}>
                        <option value="Customer">Customer</option>
                        <option value="Specialist">Specialist</option>
                        <option value="BiteSpeed">BiteSpeed</option>
                        <option value="Partner">Partner</option>
                      </select>
                    </div>
                    <button type="submit" className="btn-primary" style={{ padding: '0.5rem 0.75rem', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>Save</button>
                  </form>
                  <p style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', marginTop: '0.5rem' }}>Due Day {track.due_day} · Owner: {track.owner_type}</p>
                </div>
              );
            })}
          </div>

          {/* AM Handoff Panel */}
          {account.conversion_status === 'Converted' && account.initial_plan_value_inr >= 21000 && !account.account_manager_id && (
            <div className="card" style={{ marginBottom: '1.5rem', borderLeft: '4px solid var(--accent-secondary)', background: 'rgba(139, 92, 246, 0.05)' }}>
              <h3 style={{ marginBottom: '0.75rem', fontSize: '1rem', color: 'var(--accent-secondary)' }}>🤝 Formal AM Handoff Ready <span style={{fontSize: '0.75rem', fontWeight: 'normal', color: 'var(--text-tertiary)', fontStyle: 'italic'}}>(₹21k Provisional Threshold)</span></h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-primary)', marginBottom: '1rem' }}>This account has converted and reached the provisional ₹21,000 threshold. It is ready for formal handoff to an Account Manager.</p>
              <form action={async (formData) => {
                'use server';
                const amId = formData.get('am_id') as string;
                await handoffToAM(account.id, amId);
              }}>
                <select name="am_id" className="form-select" style={{ marginBottom: '1rem' }} required>
                  {ams.map(am => (
                    <option key={am.id} value={am.id}>{am.name}</option>
                  ))}
                </select>
                <button type="submit" className="btn-primary" style={{ width: '100%', background: 'var(--accent-secondary)', color: 'white' }}>Transfer Ownership to AM</button>
              </form>
            </div>
          )}

          {/* Action Panel */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="card">
              <h3 style={{ marginBottom: '0.75rem', fontSize: '1rem' }}>📝 Log Customer Update</h3>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginBottom: '0.75rem' }}>This resets the communication cadence clock.</p>
              <form action={logUpdateAction}>
                <input type="hidden" name="update_type" value="customer_update" />
                <textarea name="text" className="form-input" rows={3} placeholder="Customer sent a WhatsApp message..." required style={{ marginBottom: '0.75rem' }} />
                <button type="submit" className="btn-primary" style={{ width: '100%' }}>Log Update</button>
              </form>
            </div>
            
            <div className="card" style={{ borderColor: 'rgba(239, 68, 68, 0.2)' }}>
              <h3 style={{ marginBottom: '0.75rem', fontSize: '1rem', color: 'var(--status-red)' }}>🚨 Flag Blocker</h3>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginBottom: '0.75rem' }}>Creates an Escalation Event visible to Backstop.</p>
              <form action={flagBlockerAction}>
                <select name="type" className="form-select" style={{ marginBottom: '0.75rem' }} required>
                  <option value="customer">Customer Blocker</option>
                  <option value="bitespeed">BiteSpeed Blocker</option>
                  <option value="partner">Partner Blocker</option>
                </select>
                <textarea name="reason" className="form-input" rows={2} placeholder="Reason for blocker..." required style={{ marginBottom: '0.75rem' }} />
                <button type="submit" className="btn-primary" style={{ width: '100%', background: 'var(--status-red)' }}>Escalate</button>
              </form>
            </div>

            {/* WhatsApp Nudge Panel */}
            <div className="card" style={{ gridColumn: '1 / -1', borderLeft: '4px solid #25D366' }}>
              <h3 style={{ marginBottom: '0.75rem', fontSize: '1rem', color: '#25D366' }}>📱 Generate WhatsApp Nudge</h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', marginBottom: '1rem' }}>Auto-draft a contextual message to the customer.</p>
              {account.phone_number ? (
                <a 
                  href={`whatsapp://send?phone=${account.phone_number.replace(/\D/g, '')}&text=${encodeURIComponent(nudgeMessage)}`} 
                  className="btn-primary" 
                  style={{ background: '#25D366', color: '#fff', textDecoration: 'none', display: 'flex', justifyContent: 'center', alignItems: 'center' }} 
                  target="_blank" 
                  rel="noreferrer"
                  onClick={(e) => {
                    // We don't prevent default, we want it to open WhatsApp.
                    // But we could trigger an optimistic update or log.
                  }}
                >
                  Open WhatsApp Nudge
                </a>
              ) : (
                <p style={{ color: 'var(--status-red)', fontSize: '0.85rem' }}>No phone number on file. Update Account Details above.</p>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN */}
        <div>
          {/* Account info card */}
          <div className="card" style={{ marginBottom: '1.5rem' }}>
            <h3 style={{ marginBottom: '1rem', fontSize: '1rem' }}>Account Info</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', fontSize: '0.85rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-tertiary)' }}>OM</span> <span style={{ fontWeight: 500 }}>{account.om?.name || '—'}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-tertiary)' }}>Specialist</span> <span style={{ fontWeight: 500 }}>{account.specialist?.name || '—'}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-tertiary)' }}>Trial Start</span> <span>{new Date(account.trial_start_date).toLocaleDateString()}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-tertiary)' }}>Trial Day</span> <span>Day {trialDay}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-tertiary)' }}>Priority</span> <span style={{ fontWeight: 700, color: priorityLevel === 'P1' || priorityLevel === 'P2' ? 'var(--status-red)' : priorityLevel === 'P3' ? 'var(--status-amber)' : 'var(--accent-primary)' }}>{priorityLevel}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-tertiary)' }}>Risk Score</span> <span className={`badge ${risk.label.toLowerCase()}`} style={{ fontSize: '0.75rem' }}>{risk.label} ({risk.score}/3)</span></div>
            </div>
          </div>

          {/* Escalation History */}
          {account.escalations.length > 0 && (
            <div className="card" style={{ marginBottom: '1.5rem', borderColor: 'rgba(239, 68, 68, 0.2)' }}>
              <h3 style={{ marginBottom: '1rem', fontSize: '1rem', color: 'var(--status-red)' }}>Escalation History</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {account.escalations.map(esc => (
                  <div key={esc.id} style={{ background: 'var(--surface-elevated)', padding: '0.75rem', borderRadius: 'var(--radius-md)', borderLeft: `3px solid ${esc.resolved_at ? 'var(--status-green)' : 'var(--status-red)'}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-tertiary)', marginBottom: '0.25rem' }}>
                      <span>Tier {esc.tier} · {esc.blocker_type}</span>
                      <span>{esc.resolved_at ? '✅ Resolved' : esc.acknowledged_at ? '👁 Acknowledged' : '🔴 Open'}</span>
                    </div>
                    <p style={{ fontSize: '0.85rem' }}>{esc.reason}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Activity Log */}
          <div className="card">
            <h3 style={{ marginBottom: '1rem', fontSize: '1rem' }}>Activity Log</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '500px', overflowY: 'auto' }}>
              {account.updateLogs.map(log => (
                <div key={log.id} style={{ borderLeft: `2px solid ${log.type === 'customer_update' ? 'var(--accent-primary)' : log.type === 'blocker_flagged' ? 'var(--status-red)' : 'var(--text-tertiary)'}`, paddingLeft: '0.75rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-tertiary)', marginBottom: '0.15rem' }}>
                    <span style={{ textTransform: 'uppercase', letterSpacing: '0.04em' }}>{log.type.replaceAll('_', ' ')}</span>
                    <span>{new Date(log.created_at).toLocaleString()}</span>
                  </div>
                  <p style={{ fontSize: '0.85rem' }}>{log.text}</p>
                </div>
              ))}
              {account.updateLogs.length === 0 && <p style={{ color: 'var(--text-tertiary)', fontSize: '0.85rem' }}>No activity yet.</p>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
