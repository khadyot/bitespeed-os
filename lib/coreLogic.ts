export const AM_THRESHOLD = 50000;

export function getTrialDay(trialStart: Date): number {
  const start = new Date(trialStart).getTime();
  const now = new Date().getTime();
  return Math.max(0, Math.floor((now - start) / (1000 * 60 * 60 * 24)));
}

export function computeStage(
  conversionStatus: string,
  trialStart: Date,
  planValue: number
): string {
  if (['Lost', 'Stalled'].includes(conversionStatus)) {
    return `Closed, ${conversionStatus}`;
  }
  
  if (conversionStatus === 'Converted') {
    if (planValue >= AM_THRESHOLD) return 'Post-Conversion, AM';
    return 'Post-Conversion, OM/Sales';
  }

  const day = getTrialDay(trialStart);
  if (day <= 7) return `Trial, Day ${day} of 7`;
  if (day <= 14) return `Extended, Day ${day} of 14`;
  return 'Trial, Past Day 14 (Unresolved)';
}

export function computeSlaStatus(tracks: any[], trialStart: Date): { status: 'On Track' | 'At Risk' | 'Breached', breachedTrack?: any, riskTrack?: any } {
  const day = getTrialDay(trialStart);
  let worst: 'On Track' | 'At Risk' | 'Breached' = 'On Track';
  let breachedTrack = null;
  let riskTrack = null;

  for (const t of tracks) {
    if (t.status === 'complete' || t.status === 'not_applicable') continue;
    
    const daysSinceUpdate = Math.max(0, Math.floor((new Date().getTime() - new Date(t.last_updated_at).getTime()) / (1000 * 60 * 60 * 24)));

    if (t.owner_type === 'Customer') {
      if (day >= 7) {
        worst = 'Breached';
        breachedTrack = t;
      } else if (day >= t.due_day && worst !== 'Breached') {
        worst = 'At Risk';
        riskTrack = t;
      }
    } else if (t.owner_type === 'Specialist' || t.owner_type === 'BiteSpeed') {
      if (daysSinceUpdate >= 3) {
        worst = 'Breached';
        breachedTrack = t;
      } else if (daysSinceUpdate >= 1 && worst !== 'Breached') {
        worst = 'At Risk';
        riskTrack = t;
      }
    } else if (t.owner_type === 'Partner') {
      if (day >= 4 && t.status !== 'complete') {
        worst = 'At Risk'; 
        riskTrack = t;
      }
    }
  }

  return { status: worst, breachedTrack, riskTrack };
}

export function computeRiskScore(
  account: { conversion_status: string; revenue_generated_during_trial_inr: number; orders_attributed_during_trial: number; plan_stack: string; trial_start_date: Date },
  slaStatus: string
): { score: number; label: string } {
  if (['Lost', 'Stalled'].includes(account.conversion_status)) {
    return { score: 0, label: 'Closed' };
  }

  let score = 0;
  const trialDay = getTrialDay(account.trial_start_date);

  if (account.conversion_status !== 'Converted') {
    if (account.revenue_generated_during_trial_inr === 0 && account.orders_attributed_during_trial === 0 && trialDay >= 5) {
      score += 1;
    }
  }

  if (slaStatus !== 'On Track') score += 1;
  if (account.plan_stack === 'Omnichannel') score += 1;

  let label = 'Green';
  if (score >= 2) label = 'Red';
  else if (score === 1) label = 'Amber';

  return { score, label };
}

export function computeEscalationTier(
  stage: string,
  lastUpdateDate: Date | null,
  slaStatus: string
): { tier: number, softFlag: boolean } {
  if (slaStatus === 'Breached') return { tier: 2, softFlag: false };

  if (!lastUpdateDate) return { tier: 0, softFlag: false };
  const daysSinceUpdate = Math.max(0, Math.floor((new Date().getTime() - new Date(lastUpdateDate).getTime()) / (1000 * 60 * 60 * 24)));

  if (stage.includes('Trial') || stage.includes('Extended')) {
    if (daysSinceUpdate >= 4) return { tier: 2, softFlag: false };
    if (daysSinceUpdate >= 3) return { tier: 0, softFlag: true };
  } else if (stage.includes('OM/Sales')) {
    if (daysSinceUpdate >= 7) return { tier: 2, softFlag: false };
    if (daysSinceUpdate >= 5) return { tier: 0, softFlag: true };
  } else if (stage.includes('AM')) {
    if (daysSinceUpdate >= 30) return { tier: 2, softFlag: false };
    if (daysSinceUpdate >= 20) return { tier: 0, softFlag: true };
  }

  return { tier: 0, softFlag: false };
}

export function computePriorityScore(
  riskLabel: string,
  escalationTier: number,
  daysOverdueOnCurrentTrack: number
): { score: number; level: string } {
  let riskWeight = 0;
  if (riskLabel === 'Red') riskWeight = 30;
  else if (riskLabel === 'Amber') riskWeight = 20;
  else if (riskLabel === 'Green') riskWeight = 10;

  let escWeight = 0;
  if (escalationTier === 2) escWeight = 20;
  else if (escalationTier === 1) escWeight = 10;

  const score = riskWeight + escWeight + (daysOverdueOnCurrentTrack * 5);
  
  let level = 'P5';
  if (score >= 50) level = 'P1';
  else if (score >= 40) level = 'P2';
  else if (score >= 30) level = 'P3';
  else if (score >= 20) level = 'P4';
  
  return { score, level };
}
