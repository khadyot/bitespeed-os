import { prisma } from '@/lib/db';
import { computeStage, computeSlaStatus, computeRiskScore, computeEscalationTier, computePriorityScore, getTrialDay } from '@/lib/coreLogic';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

function escapeCsv(val: string | number | null | undefined): string {
  if (val === null || val === undefined) return '';
  const s = String(val);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export async function GET(request: NextRequest) {
  const view = request.nextUrl.searchParams.get('view') || 'accounts';

  const accounts = await prisma.account.findMany({
    include: { tracks: true, om: true, specialist: true }
  });

  if (view === 'accounts') {
    const header = ['Brand', 'Plan', 'Segment', 'OM', 'Specialist', 'Stage', 'Conversion Status', 'Trial Day', 'Revenue (INR)', 'Orders', 'SLA Status', 'Risk', 'Escalation Tier', 'Priority Score', 'DNS', 'Migration', 'Chatbot', 'Warmup', 'Last Update'];

    const rows = accounts.map(acc => {
      const stage = computeStage(acc.conversion_status, acc.trial_start_date, acc.initial_plan_value_inr);
      const sla = computeSlaStatus(acc.tracks, acc.trial_start_date);
      const risk = computeRiskScore(acc, sla.status);
      const { tier } = computeEscalationTier(stage, acc.last_customer_update_date, sla.status);
      const { score: priorityScore, level: priorityLevel } = computePriorityScore(risk.label, tier, 0);
      const trialDay = getTrialDay(acc.trial_start_date);

      const getTrackStatus = (type: string) => {
        const t = acc.tracks.find(tr => tr.type === type);
        return t ? t.status : 'n/a';
      };

      return [
        acc.brand_name, acc.plan_stack, acc.segment,
        acc.om?.name || '', acc.specialist?.name || '',
        stage, acc.conversion_status, trialDay,
        acc.revenue_generated_during_trial_inr, acc.orders_attributed_during_trial,
        sla.status, risk.label, tier, priorityLevel,
        getTrackStatus('dns'), getTrackStatus('migration'), getTrackStatus('chatbot'), getTrackStatus('warmup'),
        acc.last_customer_update_date ? new Date(acc.last_customer_update_date).toLocaleDateString() : ''
      ];
    });

    const csv = [header.join(','), ...rows.map(r => r.map(escapeCsv).join(','))].join('\n');

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="bitespeed_accounts_${new Date().toISOString().split('T')[0]}.csv"`,
      }
    });
  }

  if (view === 'tracks') {
    const header = ['Brand', 'Track Type', 'Status', 'Owner', 'Due Day', 'Trial Day', 'OM', 'Last Updated'];
    const rows: (string | number)[][] = [];

    accounts.forEach(acc => {
      const trialDay = getTrialDay(acc.trial_start_date);
      acc.tracks.forEach(t => {
        if (t.status === 'not_applicable') return;
        rows.push([
          acc.brand_name, t.type, t.status, t.owner_type, t.due_day, trialDay,
          acc.om?.name || '',
          new Date(t.last_updated_at).toLocaleDateString()
        ]);
      });
    });

    const csv = [header.join(','), ...rows.map(r => r.map(escapeCsv).join(','))].join('\n');

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="bitespeed_tracks_${new Date().toISOString().split('T')[0]}.csv"`,
      }
    });
  }

  if (view === 'review') {
    const header = ['Plan', 'Total Accounts', 'Converted', 'Conversion %', 'With Revenue', 'Breached', 'Total Revenue'];
    const planStats: Record<string, { total: number, converted: number, revenue: number, breached: number, totalRev: number }> = {};

    accounts.forEach(acc => {
      const p = acc.plan_stack;
      if (!planStats[p]) planStats[p] = { total: 0, converted: 0, revenue: 0, breached: 0, totalRev: 0 };
      planStats[p].total++;
      if (acc.conversion_status === 'Converted') planStats[p].converted++;
      if (acc.revenue_generated_during_trial_inr > 0) planStats[p].revenue++;
      const sla = computeSlaStatus(acc.tracks, acc.trial_start_date);
      if (sla.status === 'Breached') planStats[p].breached++;
      planStats[p].totalRev += acc.revenue_generated_during_trial_inr;
    });

    const rows = Object.entries(planStats).map(([plan, s]) => [
      plan, s.total, s.converted, Math.round((s.converted / s.total) * 100) + '%', s.revenue, s.breached, s.totalRev
    ]);

    const csv = [header.join(','), ...rows.map(r => r.map(escapeCsv).join(','))].join('\n');

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="bitespeed_weekly_review_${new Date().toISOString().split('T')[0]}.csv"`,
      }
    });
  }

  return NextResponse.json({ error: 'Invalid view. Use ?view=accounts|tracks|review' }, { status: 400 });
}
