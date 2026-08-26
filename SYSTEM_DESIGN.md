# System Design Write-Up

## 1. Double-Booking Prevention

Preventing two patients from booking the same slot is handled in three layers, from
UX down to the database, because relying on any single layer alone fails under
concurrent requests.

**Layer 1 — Database-level uniqueness (the real guarantee).** The `Appointment`
collection has a compound unique index on `{ doctor, date, slotTime }`, scoped with a
partial filter expression to only active statuses (`pending`, `confirmed`,
`completed`). If two booking requests for the same slot reach the server at the same
moment, both may pass application-level checks, but only one insert can succeed —
MongoDB itself rejects the second with a duplicate-key error (code `11000`), which the
error-handling middleware catches and turns into a friendly "slot just taken" message.
This is the layer that actually prevents the race condition; everything else is UX
polish on top of it.

**Layer 2 — Slot hold mechanism.** Without any reservation step, a patient could pick
a slot, spend two minutes filling in symptoms, and then discover at submission time
that someone else took it — frustrating, and it doesn't address the case where two
patients are simultaneously mid-form on the same slot. To soften this, selecting a
slot creates a `SlotHold` document (5-minute TTL, auto-deleted by MongoDB if abandoned)
with its own unique index on `{ doctor, date, slotTime }`. While held, the slot is
excluded from the availability list shown to other patients. The hold is not itself
the source of correctness — it's a courtesy layer to reduce collisions before they
reach the database — the unique index on `Appointment` remains the final backstop.

**Layer 3 — Atomic transaction.** The booking endpoint wraps "delete the hold" and
"create the appointment" in a MongoDB transaction (`session.withTransaction`), so the
two operations succeed or fail together rather than leaving a dangling hold or an
appointment without a released hold.

## 2. Doctor Leave Conflict Handling

When an admin marks a doctor on leave for a date that already has bookings, the system
must not silently strand those patients. `addLeaveDay` (in `doctorController.js`)
does the following, in order:

1. Adds the date to the doctor's `leaveDays` array (so future slot generation excludes it).
2. Queries all `pending`/`confirmed` appointments for that doctor on that date.
3. For each, sets `status: "leave_cancelled"` (distinct from a patient-initiated
   cancellation, so it's auditable and could later support "auto-suggest rebooking").
4. Attempts to send a cancellation email and delete the patient's Google Calendar
   event — both wrapped in their own try/catch, so an email or calendar failure never
   blocks the leave update itself or affects other patients in the same batch.

Because slot generation (`slotService.js`) checks `leaveDays` before generating any
slots for a date, once a doctor is marked on leave, that date simply produces zero
available slots for new bookings — no separate "blackout" logic needed.

## 3. Slot Hold Mechanism (detail)

Slots are generated on demand from three inputs: the doctor's recurring
`workingHours` (by day of week), `slotDurationMinutes`, and — subtracted from that
base set — any date on `leaveDays`, any slot with an active `Appointment`, and any
slot with a live `SlotHold`. This means availability is never stored redundantly; it's
always computed fresh, so there's no risk of a cached slot list drifting out of sync
with reality. The TTL index on `SlotHold.createdAt` (5 minutes) means an abandoned
booking flow self-heals without any cleanup job — MongoDB deletes the document
automatically, and the slot reappears as available on the next query.

## 4. Notification Failure Handling

Email and calendar sync are treated as "best effort, never blocking." A booking is
considered successful the moment the `Appointment` document is created — everything
after that (AI summary, email, calendar) is wrapped in individual try/catch blocks so
a failure in one doesn't cascade into the others or roll back the booking itself.

For emails specifically, each attempt is recorded in the appointment's `notifications`
array with a `status` (`sent`/`failed`) and `attempts` counter. A cron job
(`emailRetryJob.js`) runs every 15 minutes, finds notifications marked `failed` with
fewer than 3 attempts, and retries them, incrementing the counter each time. This
keeps delivery eventually-consistent without making the user wait on retries
synchronously, and caps retries so a permanently-invalid address doesn't retry
forever.

Google Calendar sync is optional per-user (requires OAuth consent) and is designed to
degrade gracefully: if a user hasn't connected their calendar, `createCalendarEvent`
simply returns `null` rather than throwing, so the rest of the booking flow proceeds
unaffected.
