# St Ives Law Lawyer Dashboard

**Purpose**: Multi-lawyer intake management system for St Ives Law. Tracks client screening, lead qualification, form completion, and submission to Smokeball.

## Project Overview

A React-based dashboard for lawyers to manage client intake from screening form through estate planning questionnaire completion. Supports multi-role access (lawyer vs admin), webhook integration for notifications/reminders, and real-time data sync with Supabase backend.

### Key Features

1. **Lead Management** - Pending leads with qualification workflow
2. **Form Tracking** - Multi-stage Kanban board (Sent → Opened → In Progress → Completed → Submitted)
3. **Screening Forms** - Intake forms for collecting initial client info (person or firm)
4. **Questionnaire** - Multi-part estate planning form (Parts A-D) with auto-save
5. **Webhook Integration** - Make platform for notifications, reminders, Smokeball submission
6. **Multi-Lawyer Support** - Role-based access, lawyer assignment, filtering by responsible lawyer
7. **Overdue Tracking** - Auto-reminders at 3 days, 1 week, 2 weeks
8. **Dashboard Overview** - Pending intake forms, completed forms at a glance

## Tech Stack

- **Frontend**: React 18, TypeScript, Vite
- **Backend**: Supabase (PostgreSQL + Auth)
- **Real-time**: Supabase subscriptions
- **Webhooks**: Make platform integration
- **Auth**: Supabase Auth (email/password)
- **Styling**: CSS with dashboard.css for Kanban/grid layouts

## Data Model

### Tables

**lawyers**
- id (UUID, primary key)
- email (unique)
- full_name (e.g., "Colin Long")
- is_admin (boolean)
- created_at

**screening_submissions**
- id (UUID)
- lawyer_id (FK to lawyers)
- contact_type ('person' | 'firm')
- contact_data (JSONB: name, email, mobile, title, etc.)
- lead_type (string)
- region (string)
- person_responsible (lawyer name)
- referral_type (dropdown option)
- billing_type (dropdown option)
- status ('pending' | 'qualified' | 'rejected' | 'deprioritized')
- created_at, updated_at

**forms**
- id (UUID)
- lawyer_id (FK to lawyers)
- client_name
- client_email
- lead_type, region, referral_type, billing_type
- person_responsible (lawyer name)
- status ('sent' | 'opened' | 'in_progress' | 'completed' | 'submitted' | 'overdue' | 'deprioritized')
- form_data (JSONB: {aData, bData, cData, dData})
- progress_pct (0-100)
- unique_link (for email access)
- last_accessed (timestamp)
- created_at, updated_at
- reminder_3d_sent, reminder_1w_sent, reminder_2w_sent (tracking webhooks sent)
- marked_complete_at, submitted_at

## File Structure

```
src/
├── pages/
│   ├── DashboardV2.tsx         (Main dashboard, Kanban board, Overview)
│   ├── LoginPage.tsx           (Auth entry)
│   ├── SignUp.tsx              (Lawyer sign-up with name selection)
│   ├── ScreeningFormV2.tsx     (Intake form for new leads)
│   └── App.tsx                 (Main form viewer, auto-save, form loading)
├── context/
│   └── AuthContext.tsx         (Login state, lawyer lookup by email)
├── lib/
│   ├── dashboard-actions.ts    (Qualify, reject, complete form actions)
│   ├── supabase.ts             (Supabase client)
│   └── ...
├── hooks/
│   ├── useSupabaseForms.ts     (Form CRUD operations)
│   ├── useAutoSaveSupabase.ts  (Debounced auto-save)
│   └── usePart[A-D].ts         (Form part logic)
├── styles/
│   ├── dashboard.css           (Kanban, grid, modals)
│   ├── auth.css                (Login/signup styling)
│   └── ...
├── utils/
│   ├── webhookBuilder.ts       (Smokeball payload builder)
│   ├── calculateProgress.ts    (Form completion %)
│   └── ...
└── AppRouter.tsx               (Route setup)
```

## Workflow: From Screening to Submission

1. **Screening Form** (ScreeningFormV2.tsx)
   - Lawyer creates new lead (person or firm)
   - Sets person_responsible (assigned lawyer)
   - Status: pending in screening_submissions

2. **Qualify Lead** (DashboardV2.tsx → dashboard-actions.ts)
   - Admin clicks "Qualify" on pending lead
   - Creates form record (status: 'sent')
   - Sends form link via webhook (SEND_FORM_EMAIL_WEBHOOK)
   - Moves screening to 'qualified'

3. **Client Opens Form** (App.tsx)
   - Client receives email, clicks unique_link
   - First access: form status 'sent' → 'opened'
   - Subsequent opens: status preserved
   - last_accessed updated for tracking

4. **Client Fills Form** (App.tsx)
   - Auto-save every 3 seconds (SESSION_DEBOUNCE_MS)
   - Progress calculated from form fields filled
   - Progress > 0: status 'opened' → 'in_progress'
   - Form data stored in form_data JSONB

5. **Client Submits** (App.tsx)
   - Marks form as 'completed'
   - Sends completion confirmation webhook

6. **Lawyer Reviews** (DashboardV2.tsx)
   - Lawyer views completed form
   - Can mark as submitted to Smokeball

7. **Submit to Smokeball** (dashboard-actions.ts)
   - Calls submitFormToSmokeball()
   - Builds payload from form_data parts
   - Sends to SMOKEBALL_WEBHOOK
   - Status: 'submitted'

## Form Status Lifecycle

```
pending → qualified (screening)
sent → opened → in_progress → completed → submitted (forms)
        ↓ (anytime) → deprioritized
```

**Key Rules:**
- Opening form: only 'sent' → 'opened' (first time only)
- Subsequent opens: status NOT changed
- Auto-save: 'opened' → 'in_progress' if progress > 0
- Complete: any status → 'completed'
- Submit: any status → 'submitted'

## Overdue Tracking

In DashboardV2.tsx, checkAndSendOverdueReminders():
- Runs on 10-second auto-refresh
- Checks form created_at timestamp
- At 3 days: sends reminder webhook, sets reminder_3d_sent
- At 7 days: sends reminder webhook, sets reminder_1w_sent  
- At 14 days: sends reminder webhook, sets reminder_2w_sent, status → 'overdue'

## Webhook Integration (Make Platform)

**SEND_FORM_EMAIL_WEBHOOK**
- Triggers when form created (qualification)
- Payload: form_id, client_name, client_email, form_link
- Action: Sends email to client with form link

**EMAIL_CONFIRMATION_WEBHOOK**
- Triggers when client completes form
- Payload: form_id, client_name, client_email, completed_at
- Action: Sends confirmation email to client

**REMINDER_WEBHOOK**
- Triggers at 3d, 1w, 2w
- Payload: form_id, reminder_type ('3d' | '1w' | '2w'), client details
- Action: Sends reminder email to client

**SMOKEBALL_WEBHOOK**
- Triggers when lawyer submits to Smokeball
- Payload: Full form data (aData, bData, cData, dData) formatted for Smokeball
- Action: Creates matter/intake in Smokeball

## Authentication & Authorization

- **Supabase Auth**: Email/password sign-up
- **Sign-up Flow**: 
  - New user creates account
  - Selects name from LAWYERS dropdown
  - Upserts lawyer record (creates if new, updates email if exists)
  - Sets is_admin: false
- **Role Check**: is_admin field (admin-only creation separate from public sign-up)
- **Data Filtering**: Lawyers see only forms/leads assigned to their lawyer_id

## Recent Fixes

1. **Form Status Bug** (Commits 4d049b0, e7e870d)
   - Issue: Opening form changed status to 'opened', overwriting In Progress/Completed
   - Fix: Only change 'sent' → 'opened' on first access, preserve other statuses

2. **Pending Intake Forms** (Commit e7e870d)
   - Issue: Forms disappeared from Overview when opened
   - Fix: Show all incomplete forms (!completed && !submitted)

3. **Lawyer Assignment** (Earlier commits)
   - Issue: Screening forms assigned to form creator, not person_responsible
   - Fix: Lookup person_responsible lawyer_id, assign to that lawyer

4. **Sign-up Upsert** (Earlier commits)
   - Issue: Multiple sign-ups created duplicate lawyer records
   - Fix: Upsert by full_name (update if exists, create if new)

## Known Limitations

- RLS policies currently disabled on lawyers table (needs proper policy setup for production)
- Email confirmation disabled in Supabase Auth (email rate limiting)
- Admin account creation: separate process needed, not via public sign-up

## Setup Notes

- Firebase/Smokeball: Not used in current architecture (switched to Supabase)
- Logo: Expects logo file in public directory
- Webhooks: All URLs from Make platform integration
- Git credentials: client-relations@lex-ops.io for deployment access
