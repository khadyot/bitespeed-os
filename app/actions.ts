'use server';

import { prisma } from '@/lib/db';
import { revalidatePath } from 'next/cache';

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

  revalidatePath(`/portal/${accountId}`);
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
  
  revalidatePath(`/account/${accountId}`);
}

export async function updateAccountFields(accountId: string, formData: FormData) {
  const conversion_status = formData.get('conversion_status') as string;
  const revenue = parseFloat(formData.get('revenue') as string) || 0;
  const orders = parseInt(formData.get('orders') as string) || 0;
  const segment = formData.get('segment') as string;
  const plan_stack = formData.get('plan_stack') as string;
  const initial_plan_value_inr = parseFloat(formData.get('initial_plan_value_inr') as string) || 0;

  const changes: string[] = [];
  const existing = await prisma.account.findUnique({ where: { id: accountId } });
  if (existing) {
    if (existing.conversion_status !== conversion_status) changes.push(`Status: ${existing.conversion_status} → ${conversion_status}`);
    if (existing.revenue_generated_during_trial_inr !== revenue) changes.push(`Revenue: ₹${existing.revenue_generated_during_trial_inr} → ₹${revenue}`);
    if (existing.orders_attributed_during_trial !== orders) changes.push(`Orders: ${existing.orders_attributed_during_trial} → ${orders}`);
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
    }
  });

  if (changes.length > 0) {
    await prisma.updateLog.create({
      data: {
        account_id: accountId,
        text: `Account updated: ${changes.join(', ')}`,
        type: 'track_change'
      }
    });
  }

  revalidatePath(`/account/${accountId}`);
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

  revalidatePath(`/account/${accountId}`);
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

  revalidatePath(`/account/${accountId}`);
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

  revalidatePath('/om');
}

export async function acknowledgeEscalation(escalationId: string, userId: string) {
  await prisma.escalationEvent.update({
    where: { id: escalationId },
    data: {
      acknowledged_at: new Date(),
      acknowledged_by_user_id: userId
    }
  });
  revalidatePath('/backstop');
}

export async function resolveEscalation(escalationId: string) {
  await prisma.escalationEvent.update({
    where: { id: escalationId },
    data: { resolved_at: new Date() }
  });
  revalidatePath('/backstop');
}
