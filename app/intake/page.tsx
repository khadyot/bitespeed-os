import { prisma } from '@/lib/db';
import { computeRiskScore, computeSlaStatus } from '@/lib/coreLogic';
import { createAccount } from '@/app/actions';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function IntakeForm() {
  const oms = await prisma.user.findMany({ where: { role: 'om' }, include: { accountsAsOM: { include: { tracks: true } } } });

  // Calculate recommendation
  const omStats = oms.map(om => {
    const activeAccounts = om.accountsAsOM.filter(a => !['Converted', 'Lost', 'Stalled'].includes(a.conversion_status));
    
    let redRiskCount = 0;
    activeAccounts.forEach(acc => {
      const sla = computeSlaStatus(acc.tracks, acc.trial_start_date);
      const risk = computeRiskScore(acc, sla.status);
      if (risk.label === 'Red') redRiskCount++;
    });

    return {
      id: om.id,
      name: om.name,
      activeCount: activeAccounts.length,
      redRiskCount
    };
  });

  // Sort by red risks ascending, then by active count ascending
  omStats.sort((a, b) => {
    if (a.redRiskCount !== b.redRiskCount) return a.redRiskCount - b.redRiskCount;
    return a.activeCount - b.activeCount;
  });

  const recommendedOm = omStats[0];

  return (
    <div className="container page-transition-enter" style={{ maxWidth: '600px' }}>
      <div className="header">
        <h1 className="header-title">New Account Intake</h1>
        <Link href="/" className="btn-primary" style={{ background: 'var(--surface-elevated)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }}>Switch Role</Link>
      </div>

      <div className="card" style={{ marginBottom: '2rem' }}>
        <h3 style={{ marginBottom: '1rem' }}>OM Assignment Recommendation</h3>
        {recommendedOm && (
          <p style={{ color: 'var(--text-primary)' }}>
            <span style={{ color: 'var(--accent-secondary)', fontWeight: 600 }}>{recommendedOm.name}</span> is recommended based on having {recommendedOm.redRiskCount} red-risk accounts and {25 - recommendedOm.activeCount} slots remaining before capacity.
          </p>
        )}
      </div>

      <div className="card">
        <form action={createAccount} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label className="form-label">Brand Name</label>
              <input type="text" name="brand_name" className="form-input" required />
            </div>
            <div>
              <label className="form-label">Customer Phone Number (WhatsApp)</label>
              <input type="text" name="phone_number" className="form-input" placeholder="+1234567890" />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label className="form-label">Plan Stack</label>
              <select name="plan_stack" className="form-select" required>
                <option value="Omnichannel">Omnichannel</option>
                <option value="Omnichannel + AI">Omnichannel + AI</option>
                <option value="Marketing Only">Marketing Only</option>
                <option value="Support Only">Support Only</option>
              </select>
            </div>
            
            <div>
              <label className="form-label">Segment</label>
              <select name="segment" className="form-select" required>
                <option value="Enterprise">Enterprise</option>
                <option value="Mid Market">Mid Market</option>
                <option value="SMB">SMB</option>
              </select>
            </div>
          </div>

          <div>
            <label className="form-label">Initial Plan Value (INR)</label>
            <input type="number" name="initial_plan_value_inr" className="form-input" defaultValue={20000} required />
          </div>

          <div>
            <label className="form-label">Assign Onboarding Manager</label>
            <select name="om_id" className="form-select" defaultValue={recommendedOm?.id} required>
              {omStats.map(om => (
                <option key={om.id} value={om.id}>
                  {om.name} (Load: {om.activeCount}/25, Red: {om.redRiskCount})
                </option>
              ))}
            </select>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: '0.5rem' }}>
              We've pre-selected the recommended OM, but you can override it here.
            </p>
          </div>

          <button type="submit" className="btn-primary" style={{ marginTop: '1rem' }}>Create Account & Initialize Tracks</button>
        </form>
      </div>
    </div>
  );
}
