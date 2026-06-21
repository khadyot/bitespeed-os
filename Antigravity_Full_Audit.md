# Full Logic Audit: Corrections for Antigravity

*Everything found going through `bitespeed_os_logic_defense.md` in full, organized by how confident and how load-bearing each issue is. Fix the first group, confirm the second group is intentional or fix it, the third group is informational only.*

---

## Part A: Confirmed fixes, real behavioral bugs

### A1. AM threshold value has no grounding

`AM_THRESHOLD = 50000` was set as an arbitrary placeholder, by Antigravity's own earlier confirmation, not derived from the data or the call transcript. Tanul said directly on the CS Head call that accounts below roughly $250/month never get a dedicated Account Manager. At a rough conversion, that's approximately ₹21,000, not ₹50,000, more than double the one real data point available.

**Fix:** Change `AM_THRESHOLD` from `50000` to `21000`. Keep it labeled provisional in the UI exactly as it is now, this still isn't a confirmed figure, Tanul hasn't given an exact INR number, but ₹21,000 is traceable to something she actually said.

### A2. AM threshold checked against the wrong field in the handoff trigger

Stage computation (the label shown on the account) checks `initial_plan_value_inr >= AM_THRESHOLD`. The actual AM Handoff panel, the thing that sets `account_manager_id`, checks `revenue_generated_during_trial_inr >= AM_THRESHOLD` instead. Two different fields deciding the same outcome. A Mid Market account at a high plan value but low trial revenue would show the "Post-Conversion, AM" label while the handoff panel never appears.

**Fix:** Use `initial_plan_value_inr` consistently in both places. That's the field matching the original intent, account size, not how much revenue moved during a short trial window.

### A3. OM load count excludes ALL converted accounts, not just AM-handed-off ones

Section 8 counts "Active accounts (excluding Converted, Lost, Stalled)." This excludes every converted account from an OM's load, including sub-threshold ones that stay with the same OM indefinitely by design, that's the whole point of the no-phase-reset principle. An OM with 10 active trials and 12 sub-threshold converted accounts currently shows a load of 10, not 22, which is exactly the number the 25-account cap and the new-account recommendation are both built on.

This also disagrees with the dashboard itself. Section 16 splits an OM's accounts into Active (not Lost/Stalled) and Closed (Lost/Stalled), so a sub-threshold converted account correctly shows up in the OM's own working queue, while being invisible to the capacity math deciding whether that OM gets another one.

**Fix:** An account counts toward an OM's load if `om_id` matches AND `account_manager_id` is null AND `conversion_status` is not Lost or Stalled. `account_manager_id` being null is already the data model's signal for "still OM-owned," no new field needed. Expect some OMs to show a higher load once this lands, that's the math becoming accurate, not breaking.

### A4. OM recommendation lets a small risk difference override a large load difference

Sort logic: fewest Red-risk accounts first, fewest total active accounts only as a tiebreaker. Worked example: an OM with 15 accounts and 0 Red gets recommended over an OM with 2 accounts and 1 Red, because Red count is checked first regardless of load.

**Fix:** combine both into one weighted score instead of sorting lexicographically:

```
effective_load = active_account_count + (red_risk_count × 5)
```

Recommend the OM with the lowest score. The weight of 5 reuses the priority score's existing overdue-day weight rather than inventing a new number, reasonable starting point, fine to tune.

### A5. WhatsApp nudge "haven't heard from you" trigger isn't stage-aware

The nudge drafting logic fires the "we haven't heard from you in a few days" message at a flat 3+ days of silence, regardless of account stage. Everywhere else in this system, the silence threshold is stage-aware: 3 days for trial accounts, 5 for post-conversion OM-managed, 20 for AM-managed. A flat 3-day nudge trigger means an AM-managed account on a deliberate monthly cadence gets an anxious "haven't heard from you" message after three normal, healthy days of no contact. This is the same bug shape as the original flat 7-day escalation rule that was already fixed in the main engine, it just resurfaced in a different part of the code that wasn't updated at the same time.

**Fix:** use the same stage-aware soft-flag threshold here that the escalation engine already uses (3/5/20 days by stage), not a separate hardcoded 3.

### A6. Plan Stack Change cascade is missing "Marketing Only"

The cascade table (Section 18, what happens to tracks when an OM changes an account's plan after creation) only has rows for Support Only, Omnichannel, and Omnichannel + AI. Marketing Only, one of the four real plan values, has no defined row. If an OM changes an account's plan to Marketing Only after creation, there's no matching case telling the system what to do with the four tracks.

**Fix:** add a Marketing Only row, same behavior as Omnichannel, DNS/Migration/Warmup set to `not_started` if they were N/A, Chatbot set to `not_applicable`, matching how Marketing Only already behaves at initial account creation (Section 3).

---

## Part B: Worth confirming, lower confidence or possibly intentional

### B1. Partner-owned tracks can never reach "Breached" SLA status

The SLA Engine's Partner-Owned table only has two states, At Risk and On Track, no Breached condition exists for partner tracks no matter how overdue. The automated escalation engine still seems to fire correctly on overdue partner tracks through a separate due-day check (Section 10, Step 2), so this likely isn't suppressing real escalations, but the SLA status label itself will display "At Risk" forever on a chatbot build that's 20 days overdue, which reads as understated. Worth confirming this is an intentional design choice (partner delays treated as a softer category throughout) rather than an oversight in the SLA table.

### B2. Specialist queue tiebreaker may be sorting the wrong direction

Within the same priority score, tracks are sorted by days-since-last-update ascending, "fresher tracks come first." For a queue meant to show a Specialist what to work on, the more neglected, staler track usually deserves attention first, not the one most recently touched. Worth double-checking this wasn't meant to be descending, stalest first, since the current direction would surface recently-worked items ahead of neglected ones at the same priority level.

### B3. Escalation deduplication may suppress a second, unrelated problem

The automated engine "only creates a new escalation if the account currently has zero unresolved escalations." If an account already has one open Tier 2 ticket (say, a communication-silence breach) and a completely separate track later breaches its own SLA, this second, distinct problem may never generate its own ticket, since the account no longer has zero open escalations. Worth confirming whether this is a deliberate anti-spam measure (one open ticket per account, by design) or an unintended gap where a second real issue goes unflagged because of the first.

---

## Part C: Informational, not a bug

### C1. Seed data side effect after the A1 fix

Once `AM_THRESHOLD` moves to ₹21,000, the SMB segment's default seeded plan value (₹20,000, per Section 19) will sit just under the new threshold for every SMB account, by construction of the seed data, not a new issue. Worth knowing going in so it doesn't get mistaken for something broken when re-testing, SMB accounts simply won't qualify for AM handoff under the corrected threshold unless their actual plan value is set above ₹21,000.

---

## Verification checklist

1. Pick a seeded Converted account with plan value at or above ₹21,000 but trial revenue below it. Confirm the AM Handoff panel now appears, using the corrected field and threshold.
2. Confirm an OM's counted load now includes their sub-threshold converted accounts, and matches what shows in their own `/om` dashboard queue.
3. Re-run the Intake recommendation with one high-load/zero-risk OM and one low-load/one-risk OM. Confirm the lower-effective-load OM is now recommended.
4. Confirm the 25-account cap enforcement at Intake uses the corrected load definition from item 2.
5. Trigger a WhatsApp nudge on an AM-managed post-conversion account with 3 to 19 days of silence. Confirm it does NOT show the "haven't heard from you" message, since that account's real soft-flag threshold is 20 days.
6. Change a seeded account's plan to Marketing Only after creation. Confirm the four tracks update correctly instead of hitting an undefined case.
7. For B1 through B3, reply with whether each is intentional design or something to fix, no code change needed if intentional, just confirm.

Reply back with the result of all seven, plus a one-line answer on each of the three Part B items.
