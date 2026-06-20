const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const ACCOUNTS = [
  {
    id: 'BS-TRIAL-001', brand: 'Dressfolk', plan: 'Omnichannel + AI', segment: 'Mid Market', om: 'Suhasini',
    trialStart: daysAgo(5), revenue: 0, orders: 0,
    chain1: '✅ Verified', chain2: '🔄 Audited', chain3: '🔄 With partner', chain4: '⏳ Not started',
    blocker: '', blockerOwner: '', lastUpdate: daysAgo(1),
    status: 'In Trial', sla: 'On Track', escalation: 'None', riskStatus: 'green'
  },
  {
    id: 'BS-TRIAL-002', brand: 'Naman Dharishah Ayurved', plan: 'Omnichannel', segment: 'SMB', om: 'Nidhi',
    trialStart: daysAgo(18), revenue: 0, orders: 0,
    chain1: '✅ Verified', chain2: '🔄 Access received', chain3: 'N/A', chain4: '⏳ Not started',
    blocker: 'Migration audit pending — access received 15 days ago', blockerOwner: 'BiteSpeed', lastUpdate: daysAgo(6),
    status: 'Extended', sla: 'Breached', escalation: 'Tier 3', riskStatus: 'red'
  },
  {
    id: 'BS-TRIAL-003', brand: 'Beyours Skincare', plan: 'Omnichannel + AI', segment: 'Mid Market', om: 'Suhasini',
    trialStart: daysAgo(20), revenue: 24500, orders: 14,
    chain1: '✅ Verified', chain2: '✅ Migrated', chain3: '🔄 Review done', chain4: '🔄 Plan shared',
    blocker: 'Chatbot going live — pending review', blockerOwner: 'BiteSpeed', lastUpdate: daysAgo(2),
    status: 'Converted'
  },
  {
    id: 'BS-TRIAL-004', brand: 'SnapUp Electronics', plan: 'Marketing Only', segment: 'SMB', om: 'Shweta',
    trialStart: daysAgo(12), revenue: 0, orders: 0,
    chain1: '🔄 Records shared', chain2: '⏳ No access', chain3: 'N/A', chain4: '⏳ Not started',
    blocker: 'Customer Review Pending — DNS records not added', blockerOwner: 'Customer', lastUpdate: daysAgo(8),
    status: 'In Trial'
  },
  {
    id: 'BS-TRIAL-005', brand: 'Soni Fashion', plan: 'Omnichannel', segment: 'Enterprise', om: 'Akanksha',
    trialStart: daysAgo(16), revenue: 0, orders: 0,
    chain1: '✅ Verified', chain2: '🔄 Access received', chain3: 'N/A', chain4: '⏳ Not started',
    blocker: 'Customer escalated to Sales AE — OM unresponsive', blockerOwner: 'BiteSpeed', lastUpdate: daysAgo(11),
    status: 'Stalled'
  },
  {
    id: 'BS-TRIAL-006', brand: 'Aravalii Jewels', plan: 'Omnichannel + AI', segment: 'Enterprise', om: 'Rohan',
    trialStart: daysAgo(8), revenue: 18000, orders: 8,
    chain1: '✅ Verified', chain2: '🔄 Audited', chain3: '🔄 With partner', chain4: '⏳ Not started',
    blocker: '', blockerOwner: '', lastUpdate: daysAgo(1),
    status: 'In Trial'
  },
  {
    id: 'BS-TRIAL-007', brand: 'Krishna Herbals', plan: 'Omnichannel', segment: 'Mid Market', om: 'Suhasini',
    trialStart: daysAgo(10), revenue: 0, orders: 0,
    chain1: '✅ Verified', chain2: '🔄 Access received', chain3: 'N/A', chain4: '⏳ Not started',
    blocker: 'Platform access received but audit not started', blockerOwner: 'BiteSpeed', lastUpdate: daysAgo(3),
    status: 'In Trial'
  },
  {
    id: 'BS-TRIAL-008', brand: 'Bela Cart', plan: 'Omnichannel + AI', segment: 'SMB', om: 'Shweta',
    trialStart: daysAgo(14), revenue: 0, orders: 0,
    chain1: '🔄 Records shared', chain2: '✅ Migrated', chain3: '⏳ Req collected', chain4: '⏳ Not started',
    blocker: 'Email DNS not added by customer', blockerOwner: 'Customer', lastUpdate: daysAgo(4),
    status: 'Extended'
  },
  {
    id: 'BS-TRIAL-009', brand: 'Tara Essentials', plan: 'Marketing Only', segment: 'SMB', om: 'Akanksha',
    trialStart: daysAgo(11), revenue: 0, orders: 0,
    chain1: '🔄 Records shared', chain2: '⏳ No access', chain3: 'N/A', chain4: '⏳ Not started',
    blocker: 'DNS records not added by customer', blockerOwner: 'Customer', lastUpdate: daysAgo(3),
    status: 'Extended'
  },
  {
    id: 'BS-TRIAL-010', brand: 'GreenLeaf Organics', plan: 'Omnichannel + AI', segment: 'Mid Market', om: 'Rohan',
    trialStart: daysAgo(13), revenue: 42000, orders: 22,
    chain1: '✅ Verified', chain2: '✅ Migrated', chain3: '✅ Live', chain4: '✅ Started',
    blocker: '', blockerOwner: '', lastUpdate: daysAgo(1),
    status: 'In Trial'
  },
  {
    id: 'BS-TRIAL-011', brand: 'LuxeHome Decor', plan: 'Omnichannel', segment: 'Enterprise', om: 'Akanksha',
    trialStart: daysAgo(6), revenue: 0, orders: 0,
    chain1: '🔄 Records shared', chain2: '🔄 Access received', chain3: 'N/A', chain4: '⏳ Not started',
    blocker: '', blockerOwner: '', lastUpdate: daysAgo(1),
    status: 'In Trial'
  },
  {
    id: 'BS-TRIAL-012', brand: 'PureVeda Wellness', plan: 'Support Only', segment: 'SMB', om: 'Nidhi',
    trialStart: daysAgo(10), revenue: 0, orders: 0,
    chain1: 'N/A', chain2: 'N/A', chain3: 'N/A', chain4: 'N/A',
    blocker: 'WhatsApp Number Pending', blockerOwner: 'Customer', lastUpdate: daysAgo(5),
    status: 'In Trial'
  },
  {
    id: 'BS-TRIAL-013', brand: 'BloomBox Gifting', plan: 'Omnichannel + AI', segment: 'Mid Market', om: 'Suhasini',
    trialStart: daysAgo(15), revenue: 56000, orders: 31,
    chain1: '✅ Verified', chain2: '✅ Migrated', chain3: '✅ Live', chain4: '✅ Started',
    blocker: '', blockerOwner: '', lastUpdate: daysAgo(2),
    status: 'Converted'
  },
  {
    id: 'BS-TRIAL-014', brand: 'FitZone Sports', plan: 'Marketing Only', segment: 'SMB', om: 'Shweta',
    trialStart: daysAgo(7), revenue: 0, orders: 0,
    chain1: '✅ Verified', chain2: '🔄 Access received', chain3: 'N/A', chain4: '⏳ Not started',
    blocker: '', blockerOwner: '', lastUpdate: daysAgo(2),
    status: 'In Trial'
  },
  {
    id: 'BS-TRIAL-015', brand: 'Craft & Carry', plan: 'Omnichannel + AI', segment: 'SMB', om: 'Rohan',
    trialStart: daysAgo(3), revenue: 0, orders: 0,
    chain1: '🔄 Records shared', chain2: '⏳ No access', chain3: '⏳ Req collected', chain4: '⏳ Not started',
    blocker: '', blockerOwner: '', lastUpdate: daysAgo(1),
    status: 'In Trial'
  },
  {
    id: 'BS-TRIAL-016', brand: 'WellNest Living', plan: 'Omnichannel', segment: 'Mid Market', om: 'Nidhi',
    trialStart: daysAgo(14), revenue: 0, orders: 0,
    chain1: '🔄 Records shared', chain2: '⏳ No access', chain3: 'N/A', chain4: '⏳ Not started',
    blocker: 'Customer ghosted — no response since Day 5', blockerOwner: 'Customer', lastUpdate: daysAgo(9),
    status: 'Lost'
  },
  {
    id: 'BS-TRIAL-017', brand: 'RoseGold Beauty', plan: 'Omnichannel + AI', segment: 'Mid Market', om: 'Akanksha',
    trialStart: daysAgo(9), revenue: 15000, orders: 10,
    chain1: '✅ Verified', chain2: '🔄 Audited', chain3: '🔄 With partner', chain4: '⏳ Not started',
    blocker: '', blockerOwner: '', lastUpdate: daysAgo(0),
    status: 'In Trial'
  },
  {
    id: 'BS-TRIAL-018', brand: 'UrbanThreads Co', plan: 'Support Only', segment: 'SMB', om: 'Shweta',
    trialStart: daysAgo(11), revenue: 8500, orders: 5,
    chain1: 'N/A', chain2: 'N/A', chain3: 'N/A', chain4: 'N/A',
    blocker: '', blockerOwner: '', lastUpdate: daysAgo(2),
    status: 'In Trial'
  },
  {
    id: 'BS-TRIAL-019', brand: 'Naturoma Foods', plan: 'Omnichannel', segment: 'SMB', om: 'Rohan',
    trialStart: daysAgo(2), revenue: 0, orders: 0,
    chain1: '⏳ Not started', chain2: '⏳ No access', chain3: 'N/A', chain4: '⏳ Not started',
    blocker: '', blockerOwner: '', lastUpdate: daysAgo(0),
    status: 'In Trial'
  },
  {
    id: 'BS-TRIAL-020', brand: 'SilkRoute Fabrics', plan: 'Omnichannel + AI', segment: 'Enterprise', om: 'Suhasini',
    trialStart: daysAgo(12), revenue: 67000, orders: 35,
    chain1: '✅ Verified', chain2: '✅ Migrated', chain3: '🔄 Review done', chain4: '🔄 Plan shared',
    blocker: '', blockerOwner: '', lastUpdate: daysAgo(1),
    status: 'In Trial'
  }
];

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

function parseStatus(s) {
  if (s === '✅ Verified' || s === '✅ Migrated' || s === '✅ Live' || s === '✅ Started') return 'complete';
  if (s.includes('🔄')) return 'active';
  if (s === 'N/A') return 'not_applicable';
  return 'not_started';
}

function mapStatusToConversion(s) {
  if (s === 'Converted') return 'Converted';
  if (s === 'Lost') return 'Lost';
  if (s === 'Stalled') return 'Stalled';
  if (s === 'Extended') return 'At Risk';
  return 'Likely'; // Or Not Converted
}

async function main() {
  const OMS = ['Suhasini', 'Shweta', 'Akanksha', 'Rohan', 'Nidhi'];
  const createdOms = {};

  for (const omName of OMS) {
    createdOms[omName] = await prisma.user.create({
      data: {
        name: omName,
        email: `${omName.toLowerCase()}@bitespeed.co`,
        role: 'om'
      }
    });
  }

  const specialist = await prisma.user.create({
    data: { name: 'Tech Specialist', email: 'tech@bitespeed.co', role: 'specialist' }
  });

  const backstop = await prisma.user.create({
    data: { name: 'CS Head', email: 'head@bitespeed.co', role: 'backstop' }
  });

  const am = await prisma.user.create({
    data: { name: 'Account Manager', email: 'am@bitespeed.co', role: 'account_manager' }
  });

  for (const acc of ACCOUNTS) {
    const omId = createdOms[acc.om].id;

    let account_manager_id = null;
    if (acc.status === 'Converted' && acc.segment === 'Enterprise') {
      account_manager_id = am.id;
    }

    const createdAcc = await prisma.account.create({
      data: {
        id: acc.id,
        brand_name: acc.brand,
        plan_stack: acc.plan,
        segment: acc.segment,
        initial_plan_value_inr: acc.segment === 'Enterprise' ? 100000 : (acc.segment === 'Mid Market' ? 50000 : 20000),
        trial_start_date: acc.trialStart,
        conversion_status: mapStatusToConversion(acc.status),
        revenue_generated_during_trial_inr: acc.revenue,
        orders_attributed_during_trial: acc.orders,
        last_customer_update_date: acc.lastUpdate,
        om_id: omId,
        specialist_id: specialist.id,
        account_manager_id: account_manager_id
      }
    });

    const tracks = [];
    if (acc.plan !== 'Support Only') {
      tracks.push({ type: 'dns', status: parseStatus(acc.chain1), owner_type: 'Customer', due_day: 3 });
      tracks.push({ type: 'migration', status: parseStatus(acc.chain2), owner_type: 'Specialist', due_day: 5 });
      if (acc.plan === 'Omnichannel + AI') {
        tracks.push({ type: 'chatbot', status: parseStatus(acc.chain3), owner_type: 'Partner', due_day: 6 });
      } else {
        tracks.push({ type: 'chatbot', status: 'not_applicable', owner_type: 'Partner', due_day: 6 });
      }
      tracks.push({ type: 'warmup', status: parseStatus(acc.chain4), owner_type: 'Specialist', due_day: 4 });
    } else {
       tracks.push({ type: 'dns', status: 'not_applicable', owner_type: 'Customer', due_day: 3 });
       tracks.push({ type: 'migration', status: 'not_applicable', owner_type: 'Specialist', due_day: 5 });
       tracks.push({ type: 'chatbot', status: 'not_applicable', owner_type: 'Partner', due_day: 6 });
       tracks.push({ type: 'warmup', status: 'not_applicable', owner_type: 'Specialist', due_day: 4 });
    }

    for (const track of tracks) {
      await prisma.track.create({
        data: {
          account_id: createdAcc.id,
          type: track.type,
          status: track.status,
          owner_type: track.owner_type,
          due_day: track.due_day
        }
      });
    }

    if (acc.blocker) {
       await prisma.updateLog.create({
          data: {
            account_id: createdAcc.id,
            author_user_id: omId,
            type: 'blocker_flagged',
            text: acc.blocker,
          }
       });
    }
  }

  console.log('Seeding finished.');
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
