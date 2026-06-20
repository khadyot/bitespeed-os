'use server';

import { prisma } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { computeStage } from '@/lib/coreLogic';

export async function askQuestion(accountId: string, formData: FormData) {
  const question = formData.get('question') as string;
  if (!question) return;

  await prisma.updateLog.create({
    data: {
      account_id: accountId,
      text: question,
      type: 'customer_update',
    }
  });

  await prisma.account.update({
    where: { id: accountId },
    data: { last_customer_update_date: new Date() }
  });

  revalidatePath('/', 'layout');
}

export async function updateTrackStatus(trackId: string, accountId: string, formData: FormData) {
  const status = formData.get('status') as string;
  const owner_type = formData.get('owner_type') as string;
  
  await prisma.track.update({
    where: { id: trackId },
    data: {
      status,
      owner_type,
      last_updated_at: new Date()
    }
  });

  // Log the change
  await prisma.updateLog.create({
    data: {
      account_id: accountId,
      text: `Track updated: status → ${status}, owner → ${owner_type}`,
      type: 'track_change'
    }
  });
  
  revalidatePath('/', 'layout');
}

export async function updateAccountFields(accountId: string, formData: FormData) {
  const conversion_status = formData.get('conversion_status') as string;
  const revenue = parseFloat(formData.get('revenue') as string) || 0;
  const orders = parseInt(formData.get('orders') as string) || 0;
  const segment = formData.get('segment') as string;
  const plan_stack = formData.get('plan_stack') as string;
  const initial_plan_value_inr = parseFloat(formData.get('initial_plan_value_inr') as string) || 0;
  const phone_number = formData.get('phone_number') as string;

  const changes: string[] = [];
  const existing = await prisma.account.findUnique({ where: { id: accountId } });
  if (existing) {
    if (existing.conversion_status !== conversion_status) changes.push(`Status: ${existing.conversion_status} → ${conversion_status}`);
    if (existing.revenue_generated_during_trial_inr !== revenue) changes.push(`Revenue: ₹${existing.revenue_generated_during_trial_inr} → ₹${revenue}`);
    if (existing.orders_attributed_during_trial !== orders) changes.push(`Orders: ${existing.orders_attributed_during_trial} → ${orders}`);
    if (existing.phone_number !== phone_number) changes.push(`Phone: ${existing.phone_number || 'none'} → ${phone_number || 'none'}`);
  }

  await prisma.account.update({
    where: { id: accountId },
    data: {
      conversion_status,
      revenue_generated_during_trial_inr: revenue,
      orders_attributed_during_trial: orders,
      segment,
      plan_stack,
      initial_plan_value_inr,
      phone_number,
    }
  });

  if (existing && existing.plan_stack !== plan_stack) {
    if (plan_stack === 'Support Only') {
      await prisma.track.updateMany({
        where: { account_id: accountId },
        data: { status: 'not_applicable' }
      });
    } else if (plan_stack === 'Omnichannel') {
      await prisma.track.updateMany({
        where: { account_id: accountId, type: { in: ['dns', 'migration', 'warmup'] }, status: 'not_applicable' },
        data: { status: 'not_started' }
      });
      await prisma.track.updateMany({
        where: { account_id: accountId, type: 'chatbot' },
        data: { status: 'not_applicable' }
      });
    } else if (plan_stack === 'Omnichannel + AI') {
      await prisma.track.updateMany({
        where: { account_id: accountId, type: { in: ['dns', 'migration', 'warmup', 'chatbot'] }, status: 'not_applicable' },
        data: { status: 'not_started' }
      });
    }
  }

  if (changes.length > 0) {
    await prisma.updateLog.create({
      data: {
        account_id: accountId,
        text: `Account updated: ${changes.join(', ')}`,
        type: 'track_change'
      }
    });
  }

  revalidatePath('/', 'layout');
}

export async function flagBlocker(accountId: string, authorId: string, formData: FormData) {
  const reason = formData.get('reason') as string;
  const type = formData.get('type') as string;
  
  await prisma.escalationEvent.create({
    data: {
      account_id: accountId,
      reason,
      blocker_type: type,
      tier: type === 'partner' ? 1 : 2,
    }
  });
  
  await prisma.updateLog.create({
    data: {
      account_id: accountId,
      author_user_id: authorId || undefined,
      text: `Blocker Flagged (${type}): ${reason}`,
      type: 'blocker_flagged'
    }
  });

  revalidatePath('/', 'layout');
}

export async function logUpdate(accountId: string, authorId: string, formData: FormData) {
  const text = formData.get('text') as string;
  const updateType = formData.get('update_type') as string || 'customer_update';
  
  await prisma.updateLog.create({
    data: {
      account_id: accountId,
      author_user_id: authorId || undefined,
      text,
      type: updateType
    }
  });
  
  // Only reset comms clock for customer_update type
  if (updateType === 'customer_update') {
    await prisma.account.update({
      where: { id: accountId },
      data: { last_customer_update_date: new Date() }
    });
  }

  revalidatePath('/', 'layout');
}

export async function createAccount(formData: FormData) {
  const brand_name = formData.get('brand_name') as string;
  const plan_stack = formData.get('plan_stack') as string;
  const segment = formData.get('segment') as string;
  const initial_plan_value_inr = parseFloat(formData.get('initial_plan_value_inr') as string);
  const om_id = formData.get('om_id') as string;

  const specialist = await prisma.user.findFirst({ where: { role: 'specialist' } });

  const account = await prisma.account.create({
    data: {
      brand_name,
      plan_stack,
      segment,
      initial_plan_value_inr,
      trial_start_date: new Date(),
      conversion_status: 'Not Converted',
      om_id,
      specialist_id: specialist?.id,
      phone_number: formData.get('phone_number') as string,
    }
  });

  const tracksToCreate = [];
  if (plan_stack !== 'Support Only') {
    tracksToCreate.push({ type: 'dns', status: 'not_started', owner_type: 'Customer', due_day: 3 });
    tracksToCreate.push({ type: 'migration', status: 'not_started', owner_type: 'Specialist', due_day: 5 });
    if (plan_stack === 'Omnichannel + AI') {
      tracksToCreate.push({ type: 'chatbot', status: 'not_started', owner_type: 'Partner', due_day: 6 });
    } else {
      tracksToCreate.push({ type: 'chatbot', status: 'not_applicable', owner_type: 'Partner', due_day: 6 });
    }
    tracksToCreate.push({ type: 'warmup', status: 'not_started', owner_type: 'Specialist', due_day: 4 });
  } else {
    tracksToCreate.push({ type: 'dns', status: 'not_applicable', owner_type: 'Customer', due_day: 3 });
    tracksToCreate.push({ type: 'migration', status: 'not_applicable', owner_type: 'Specialist', due_day: 5 });
    tracksToCreate.push({ type: 'chatbot', status: 'not_applicable', owner_type: 'Partner', due_day: 6 });
    tracksToCreate.push({ type: 'warmup', status: 'not_applicable', owner_type: 'Specialist', due_day: 4 });
  }

  for (const t of tracksToCreate) {
    await prisma.track.create({
      data: {
        account_id: account.id,
        type: t.type,
        status: t.status,
        owner_type: t.owner_type,
        due_day: t.due_day
      }
    });
  }

  revalidatePath('/', 'layout');
}

export async function acknowledgeEscalation(escalationId: string, userId: string) {
  await prisma.escalationEvent.update({
    where: { id: escalationId },
    data: {
      acknowledged_at: new Date(),
      acknowledged_by_user_id: userId
    }
  });
  revalidatePath('/', 'layout');
}

export async function resolveEscalation(escalationId: string) {
  await prisma.escalationEvent.update({
    where: { id: escalationId },
    data: { resolved_at: new Date() }
  });
  revalidatePath('/', 'layout');
}

export async function handoffToAM(accountId: string, amId: string) {
  await prisma.account.update({
    where: { id: accountId },
    data: { account_manager_id: amId }
  });
  await prisma.updateLog.create({
    data: {
      account_id: accountId,
      text: `Account handed off to Account Manager.`,
      type: 'track_change'
    }
  });
  revalidatePath('/', 'layout');
}

export async function runEscalationEngine() {
  const accounts = await prisma.account.findMany({
    where: { conversion_status: { notIn: ['Lost', 'Stalled'] } },
    include: { tracks: true, escalations: { where: { resolved_at: null } } }
  });
  
  const now = new Date().getTime();
  let createdCount = 0;

  for (const acc of accounts) {
    let escalationReason = null;
    let blockerType = 'bitespeed';

    const daysSinceUpdate = acc.last_customer_update_date ? Math.max(0, Math.floor((now - new Date(acc.last_customer_update_date).getTime()) / (1000 * 60 * 60 * 24))) : 0;
    
    const stage = computeStage(acc.conversion_status, acc.trial_start_date, acc.initial_plan_value_inr);
    let commsThreshold = 7;
    if (stage.includes('Trial') || stage.includes('Extended')) {
      commsThreshold = 4;
    } else if (stage.includes('OM/Sales')) {
      commsThreshold = 7;
    } else if (stage.includes('AM')) {
      commsThreshold = 30;
    }

    // Check communication breach (stage-aware limit)
    if (daysSinceUpdate >= commsThreshold) {
      escalationReason = `No customer communication for ${daysSinceUpdate} days (Limit: ${commsThreshold} days).`;
      blockerType = 'customer';
    } else {
      // Check track SLA breaches
      for (const track of acc.tracks) {
        if (track.status === 'complete' || track.status === 'not_applicable') continue;
        const targetDate = new Date(acc.trial_start_date);
        targetDate.setDate(targetDate.getDate() + track.due_day);
        
        if (now > targetDate.getTime()) {
          escalationReason = `${track.type.toUpperCase()} track is overdue by ${Math.floor((now - targetDate.getTime()) / (1000 * 60 * 60 * 24))} days.`;
          blockerType = track.owner_type.toLowerCase() === 'customer' ? 'customer' : track.owner_type.toLowerCase() === 'partner' ? 'partner' : 'bitespeed';
          break; // Flag the first breached track we find
        }
      }
    }

    if (escalationReason) {
      // Create if doesn't already have one
      if (acc.escalations.length === 0) {
        await prisma.escalationEvent.create({
          data: {
            account_id: acc.id,
            tier: 2,
            reason: `[AUTO-ESCALATION] ${escalationReason}`,
            blocker_type: blockerType,
          }
        });
        
        await prisma.updateLog.create({
          data: {
            account_id: acc.id,
            text: `System auto-flagged Escalation (Tier 2): ${escalationReason}`,
            type: 'escalation_note'
          }
        });
        createdCount++;
      }
    }
  }
  
  revalidatePath('/', 'layout');
}
