# Healthcare Appointment & Follow-up Manager

A full-stack clinic platform (MERN) with separate portals for patients, doctors, and
an admin. Patients book appointments and share symptoms in advance; an LLM generates
a pre-visit summary for the doctor and a patient-friendly post-visit summary; both
sides are kept informed via email and Google Calendar.

## Tech Stack

- **Frontend:** React 18 (Vite), React Router, Axios
- **Backend:** Node.js, Express
- **Database:** MongoDB (Atlas), Mongoose
- **Auth:** JWT, bcrypt password hashing, role-based middleware (patient / doctor / admin)
- **LLM:** Groq API (`openai/gpt-oss-20b`)
- **Email:** Nodemailer (Gmail SMTP)
- **Calendar:** Google Calendar API (OAuth 2.0)
- **Background jobs:** node-cron (medication reminders, email retry)

---

## 1. Prerequisites

- Node.js 18+ and npm
- A MongoDB Atlas account (free tier)
- A Google account (for Gmail SMTP + Google Cloud Console)
- A Groq account (free)

---

## 2. Setup Guide

### 2.1 MongoDB Atlas

1. Sign up at https://www.mongodb.com/cloud/atlas/register
2. Create a free **M0** cluster (any region)
3. Under **Database Access**, create a database user (username + password — avoid `@` or `/` in the password)
4. Under **Network Access**, add `0.0.0.0/0` (allow from anywhere) for development
5. Click **Connect → Drivers**, copy the connection string:
   ```
   mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/clinic-app?retryWrites=true&w=majority
   ```

### 2.2 Groq (LLM)

1. Sign up at https://console.groq.com
2. Go to **API Keys → Create API Key**, copy it
3. No billing setup needed — free tier is generous

### 2.3 Gmail SMTP (Email)

1. Enable 2-Step Verification: https://myaccount.google.com/security
2. Create an App Password: https://myaccount.google.com/apppasswords
3. Use your Gmail address + the 16-character app password (not your real password)

### 2.4 Google Calendar API (OAuth 2.0)

1. Go to https://console.cloud.google.com → create a new project
2. **APIs & Services → Library** → enable **Google Calendar API**
3. **APIs & Services → OAuth consent screen** → External → fill app name/email → save (Testing mode is fine; add your Google account as a test user)
4. **APIs & Services → Credentials → Create Credentials → OAuth client ID** → type: Web application
5. Add authorized redirect URI: `http://localhost:5000/api/auth/google/callback`
6. Copy the **Client ID** and **Client Secret**

### 2.5 Install & run

```bash
# Backend
cd backend
cp .env.example .env      # fill in all values from steps above
npm install
npm run seed               # creates admin@clinic.com / admin123
npm run dev                 # starts on http://localhost:5000

# Frontend (in a new terminal)
cd frontend
cp .env.example .env       # set VITE_API_URL if backend isn't on localhost:5000
npm install
npm run dev                 # starts on http://localhost:5173
```

Log in as `admin@clinic.com` / `admin123` to create doctor accounts. Patients can self-register from the UI. Doctors log in with the credentials the admin set for them.

Each user (patient/doctor) can optionally connect Google Calendar by calling
`GET /api/auth/google/connect` while logged in, which returns a consent URL to visit.

---

## 3. Database Schema

**User**
| Field | Type | Notes |
|---|---|---|
| name, email, password | String | password bcrypt-hashed |
| role | enum | patient / doctor / admin |
| phone | String | |
| googleTokens | Object | accessToken, refreshToken, expiryDate |

**DoctorProfile** (1:1 with a User of role `doctor`)
| Field | Type | Notes |
|---|---|---|
| user | ObjectId → User | |
| specialisation | String | |
| slotDurationMinutes | Number | |
| workingHours | [{ dayOfWeek, startTime, endTime }] | recurring weekly schedule |
| leaveDays | [{ date, reason }] | specific dates off |

**Appointment**
| Field | Type | Notes |
|---|---|---|
| patient, doctor | ObjectId refs | |
| date, slotTime | String | `YYYY-MM-DD`, `HH:MM` |
| status | enum | pending / confirmed / cancelled / completed / leave_cancelled |
| symptoms | String | raw patient input |
| preVisitSummary | Object | urgency, chiefComplaint, suggestedQuestions, failed flag |
| doctorNotes, prescription | | post-visit clinical data |
| postVisitSummary | Object | patient-friendly text, failed flag |
| googleEventId, doctorGoogleEventId | String | for update/delete on reschedule/cancel |
| notifications | [{ type, recipient, status, attempts }] | drives the email retry job |

**Unique compound index:** `{ doctor, date, slotTime }` with a partial filter on active
statuses — this is what makes double-booking impossible at the database level.

**SlotHold** — short-lived (5 min TTL) document created when a patient selects a slot,
deleted automatically by MongoDB if abandoned, or deleted explicitly when the booking
is confirmed. Also has a unique index on `{ doctor, date, slotTime }`.

---

## 4. API Reference

All routes prefixed with `/api`. Authenticated routes require `Authorization: Bearer <token>`.

| Method | Route | Role | Description |
|---|---|---|---|
| POST | `/auth/register` | public | Patient self-registration |
| POST | `/auth/login` | public | Login (all roles) |
| GET | `/auth/me` | any | Current user |
| GET | `/auth/google/connect` | any | Get Google OAuth consent URL |
| GET | `/auth/google/callback` | — | OAuth redirect target |
| GET | `/doctors` | public | List/search doctors (`?specialisation=`) |
| GET | `/doctors/:id` | public | Doctor detail |
| GET | `/doctors/:id/slots?date=` | public | Available slots for a date |
| POST | `/doctors` | admin | Create doctor |
| PUT | `/doctors/:id` | admin | Update doctor profile |
| POST | `/doctors/:id/leave` | admin | Add leave day (auto-cancels + notifies affected patients) |
| POST | `/appointments/hold` | patient | Place a 5-min hold on a slot |
| POST | `/appointments` | patient | Confirm booking (consumes the hold) |
| GET | `/appointments` | any | List own appointments |
| GET | `/appointments/:id` | any | Appointment detail |
| PUT | `/appointments/:id/notes` | doctor | Submit post-visit notes + prescription |
| PUT | `/appointments/:id/cancel` | any | Cancel an appointment |

---

## 5. LLM Prompts

**Pre-visit summary** (system prompt sent to Groq):
> You are a clinical triage assistant. Analyse the patient's described symptoms and
> respond ONLY with a JSON object: `{ urgency: "Low"|"Medium"|"High", chiefComplaint,
> suggestedQuestions: [3 questions] }`.

**Post-visit summary:**
> You are a medical communication assistant. Convert clinical notes and a prescription
> into a warm, clear, patient-friendly summary. Respond ONLY with JSON: `{ summary,
> medicationSchedule, followUpSteps }`.

Both calls use `response_format: { type: "json_object" }` for reliable parsing, and are
wrapped in try/catch — on any failure (missing key, network error, bad JSON), a
fallback object is returned and `failed: true` is stored on the appointment, so the
booking/visit flow never breaks and the frontend can show "AI summary unavailable."

---

## 6. Project Structure

```
clinic-app/
├── backend/
│   └── src/
│       ├── models/       User, DoctorProfile, Appointment, SlotHold
│       ├── controllers/  auth, doctor, appointment logic
│       ├── routes/       Express route definitions
│       ├── middleware/   JWT auth, role guard, error handler
│       ├── services/     llmService, emailService, calendarService, slotService
│       ├── jobs/         medicationReminderJob, emailRetryJob (node-cron)
│       ├── utils/        jwt helper, admin seed script
│       └── server.js
└── frontend/
    └── src/
        ├── pages/        Login, Register, Patient/Doctor/Admin dashboards
        ├── components/   Navbar, ProtectedRoute
        ├── context/       AuthContext
        └── api/          axios instance
```

See `SYSTEM_DESIGN.md` for the write-up on double-booking prevention, leave conflict
handling, the slot-hold mechanism, and notification failure handling.
