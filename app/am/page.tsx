import { prisma } from '@/lib/db';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function AccountManagerDashboard() {
  const amEmail = 'am@bitespeed.co';
  const user = await prisma.user.findUnique({ where: { email: amEmail } });
  if (!user) return <div className="container"><h1>AM not found</h1></div>;

  const accounts = await prisma.account.findMany({
    where: { account_manager_id: user.id },
    include: { tracks: true, om: true }
  });

  return (
    <div className="container page-transition-enter">
      <div className="header">
        <div>
          <h1 className="header-title">Account Manager Dashboard</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Welcome back, {user.name}. Post-conversion relationships.</p>
        </div>
        <Link href="/" className="btn-primary" style={{ background: 'var(--surface-elevated)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }}>Switch Role</Link>
      </div>

      <div className="card" style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>Your Accounts ({accounts.length})</h2>
        {accounts.length === 0 ? (
          <p style={{ color: 'var(--text-tertiary)', fontSize: '0.9rem' }}>No accounts have been handed off to you yet.</p>
        ) : (
          <table className="priority-table">
            <thead>
              <tr>
                <th>Brand Name</th>
                <th>Plan Stack</th>
                <th>Trial Revenue</th>
                <th>Previous OM</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map(acc => (
                <tr key={acc.id}>
                  <td style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{acc.brand_name}</td>
                  <td>{acc.plan_stack}</td>
                  <td style={{ color: 'var(--status-green)', fontWeight: 500 }}>₹{acc.revenue_generated_during_trial_inr.toLocaleString()}</td>
                  <td>{acc.om?.name || '—'}</td>
                  <td><span className="badge green">{acc.conversion_status}</span></td>
                  <td>
                    <Link href={`/account/${acc.id}`} className="btn-primary" style={{ padding: '0.4rem 0.75rem', fontSize: '0.75rem', display: 'inline-block', textDecoration: 'none' }}>View Details</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
