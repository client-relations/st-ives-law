# St Ives Law Lawyer Dashboard

**Purpose**: Multi-lawyer intake management system for St Ives Law. Tracks client screening, lead qualification, form completion, and submission to Smokeball.

**Current Date**: 2026-09-09

## Project Overview

A React-based dashboard for lawyers to manage client intake from screening form through estate planning questionnaire completion. Supports multi-role access (lawyer vs admin), webhook integration for notifications/reminders, and real-time data sync with Supabase backend.

### Key Features

1. **Lead Management** - Pending leads with qualification workflow (+ deprioritized)
2. **Form Tracking** - Kanban board: Appointment Sent → Scheduled → Pending Intake → Completed Intake
3. **Screening Forms** - ScreeningFormV2.tsx for collecting initial client info (person or firm)
4. **Inquiry Form** - Standalone HTML form (lead-inquiry.html) with 8 questions + early-exit handling
5. **Webhook Integration** - Make platform for notifications, reminders, Smokeball submission
6. **Multi-Lawyer Support** - Role-based access, lawyer assignment, filtering by responsible lawyer
7. **Dashboard Overview** - Stats on pending leads, pending intake forms, completed forms
8. **Delete Functionality** - Delete forms in Appointment Sent and Scheduled columns

## Tech Stack

- **Frontend**: React 18, TypeScript, Vite
- **Backend**: Supabase (PostgreSQL + Auth)
- **Forms**: Standalone HTML forms (lead-inquiry.html) + React components
- **APIs**: Vercel serverless functions (/api/submit-form.js, /api/get-form.js)
- **Webhooks**: Make platform integration
- **Auth**: Supabase Auth (email/password)
- **Styling**: CSS with dashboard.css for Kanban/grid layouts

## Data Model

### Tables

**lawyers**
- id (UUID, primary key)
- email (unique)
- full_name (e.g., "Michael Brown")
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
- status ('appointment_sent' | 'scheduled' | 'pending_intake' | 'completed_intake' | 'submitted' | 'deprioritized')
- form_data (JSONB: {inquiry: {...}, intake: {...}})
- progress_pct (0-100)
- unique_link (for email access)
- last_accessed (timestamp)
- created_at, updated_at
- reminder_3d_sent, reminder_1w_sent, reminder_2w_sent (timestamps)
- marked_complete_at, submitted_at (timestamps)

## File Structure

```
src/
├── pages/
│   ├── DashboardV2.tsx              (Main dashboard, Kanban board, Overview)
│   ├── LoginPage.tsx                (Auth entry)
│   ├── SignUp.tsx                   (Lawyer sign-up with name selection)
│   ├── ScreeningFormV2.tsx          (New lead screening form)
│   └── App.tsx                      (DEPRECATED - old form viewer)
├── context/
│   └── AuthContext.tsx              (Login state, lawyer lookup by email)
├── lib/
│   ├── dashboard-actions.ts         (Qualify, reject, delete, complete actions)
│   ├── supabase.ts                  (Supabase client)
│   └── ...
├── styles/
│   ├── dashboard.css                (Kanban, grid, modals)
│   ├── auth.css                     (Login/signup styling)
│   └── ...
├── utils/
│   ├── webhookBuilder.ts            (Smokeball payload builder)
│   └── ...
├── public/
│   ├── lead-inquiry.html            (Standalone inquiry form, 8 questions)
│   └── ...
└── api/
    ├── submit-form.js               (Vercel: saves form data, updates status)
    ├── get-form.js                  (Vercel: retrieves saved form data)
    └── ...
```

## Current Workflow

### 1. Create New Lead (ScreeningFormV2.tsx)
- Lawyer fills screening form with client info
- Sets person_responsible (assigned lawyer)
- Status in screening_submissions: 'pending'

### 2. Qualify Lead (DashboardV2.tsx)
- Admin clicks "Qualify" on pending lead
- Creates form record with status: 'appointment_sent'
- Sends form link via webhook (to be implemented)
- Moves screening to 'qualified'

### 3. Client Opens Inquiry Form (lead-inquiry.html)
- Client receives email, clicks unique_link
- Form loads with query param: `/lead-inquiry?lead_id={formId}`
- If no saved data: shows blank form (8-question inquiry)
- If saved data exists: shows summary view
- Status: stays 'appointment_sent' OR → 'scheduled' on submit

### 4. Client Answers Inquiry Form (lead-inquiry.html)

**Question 1: "What brings you to us?"**
- **Qualifying reasons** (continue form):
  - "Put a will or estate plan in place"
  - "Update an existing one"
- **Non-qualifying reasons** (early exit, save & contact):
  - "Someone has died" → saves data, shows "We're sorry for your loss..."
  - "A concern about a will or estate" → saves data, shows "Concerns are handled case by case..."
  - "Not sure, I'd like to talk it through" → saves data, shows "A quick conversation will help..."

**Questions 2-8**: Only shown if Q1 is qualifying. Collects:
- Q2: Name, email, phone, state
- Q3: Complexity flags (partner, will, children, etc.)
- Q4: Assets owned
- Q5: Goals for planning
- Q6: Executor confidence, specific gifts
- Q7: Funeral wishes (optional)
- Q8: Additional notes (optional)

**On Submit**:
- Sends to `/api/submit-form` with form_data.inquiry
- Status: 'appointment_sent' → 'scheduled'
- Shows summary view with checkmark

### 5. Lawyer Views Form (DashboardV2.tsx)
- Lawyer clicks "View" on form in Appointment Sent or Scheduled
- Modal shows inquiry summary (read-only for now)
- Can delete or send intake form (TBD)

### 6. Future: Intake Form
- Longer estate planning questionnaire (Parts A-D)
- Status: 'scheduled' → 'pending_intake'
- Currently: Send Intake Form button disabled

### 7. Complete & Submit (TBD)
- Lawyer marks as completed
- Status: → 'completed_intake'
- Can submit to Smokeball
- Status: → 'submitted'

## Form Status Lifecycle

```
SCREENING:
pending → qualified (✅ working)
       → rejected (✅ working)
       → deprioritized (✅ working)

FORMS (Kanban columns):
appointment_sent → scheduled (✅ on inquiry submit)
                → deprioritized (TBD)
scheduled → pending_intake (TBD - Send Intake Form button disabled)
         → deprioritized (TBD)
pending_intake → completed_intake (TBD - View button disabled)
              → deprioritized (TBD)
completed_intake → submitted (TBD - button not shown yet)
                → deprioritized (TBD)
```

## API Endpoints

### /api/submit-form (POST)
**Purpose**: Save form data, update form status

**Request**:
```json
{
  "lead_id": "form-uuid",
  "form_data": { "inquiry_reason": "...", "client_name": "...", ... },
  "form_type": "inquiry"
}
```

**Status Logic**:
- If inquiry + status appointment_sent → update to 'scheduled'
- If intake + status pending_intake → update to 'completed_intake'
- Otherwise: keep status

**Response**: `{ success: true, lead_id }`

### /api/get-form (GET)
**Purpose**: Fetch saved form data for viewing

**Query**: `?lead_id=form-uuid`

**Response**: `{ success: true, data: { inquiry: {...} }, status: "scheduled" }`

## Webhook Integration

### Current Implementation
- Using Make platform for email/reminders (TBD)
- Using n8n for Clio integration (NEW)

### Webhooks to Implement

**SEND_FORM_EMAIL_WEBHOOK** (Make Platform)
- Triggers when form created (qualification)
- Payload: form_id, client_name, client_email, form_link
- Action: Sends email to client with inquiry form link

**EMAIL_CONFIRMATION_WEBHOOK** (Make Platform)
- Triggers when client completes inquiry
- Payload: form_id, client_name, client_email, completed_at
- Action: Sends confirmation email to client

**REMINDER_WEBHOOK** (Make Platform)
- Triggers at 3d, 1w, 2w
- Payload: form_id, reminder_type, client details
- Action: Sends reminder email to client

**CLIO_INTAKE_WEBHOOK** (n8n - NEW)
- Triggers when intake form completed & validated
- Payload: Full intake form data in Clio API format (see below)
- Action: Creates/updates matter in Clio

**CLIO_SEND_BACK_WEBHOOK** (n8n - NEW)
- Triggers when intake validation fails
- Payload: form_id, client info, missing_fields array, validation_errors
- Action: Sends form back to client with missing info report via n8n

### Clio Webhook Format (RESEARCHED)

**Clio Data Structure** (from Zapier integration research):

#### Client/Contact Data
```json
{
  "type": "person|company",
  "first_name": "string",
  "middle_name": "string (optional)",
  "last_name": "string",
  "prefix": "string (optional)",
  "title": "string (optional)",
  "date_of_birth": "YYYY-MM-DD (optional)",
  "email": "string (optional)",
  "phone": "string (optional)",
  "website": "string (optional)",
  "instant_messenger": "string (optional)",
  "address": {
    "street": "string",
    "city": "string",
    "province_state": "string",
    "postal_code": "string",
    "country": "string"
  },
  "company": "string (optional - for person contacts)"
}
```

#### Matter Data
```json
{
  "client_id": "integer (required - Clio client ID)",
  "practice_area": "string",
  "description": "string",
  "originating_attorney_id": "integer (optional)",
  "responsible_attorney_id": "integer (optional)",
  "status": "string (e.g., 'Open', 'Closed')",
  "billable": "boolean",
  "budget": "decimal (optional)",
  "pending_date": "YYYY-MM-DD (optional)",
  "open_date": "YYYY-MM-DD (optional)",
  "close_date": "YYYY-MM-DD (optional)",
  "location": "string (optional)",
  "due_date": "YYYY-MM-DD (optional)",
  "notification": "boolean (optional)"
}
```

#### Custom Fields (For Estate Planning)
Clio supports custom fields via API. Likely needed:
- Will details (executors, beneficiaries, specific gifts)
- Trust information
- Power of Attorney designations
- Guardian assignments (for minors)
- Asset inventory
- Funeral preferences

**Authentication:**
- Clio uses OAuth 2.0 or API token authentication
- n8n has built-in Clio integration node (via OAuth)

---

**Current Intake Form Structure:**
The form at https://amazing-syrniki-7b0dea.netlify.app/ collects:
- Scenario & Client Details (Single/Couple, name, address, state, marital status)
- Assets & Liabilities (real estate, bank, superannuation, other)
- Document Selection (Will, EPA, Advance Care Directive, SDT)
- Executor Provisions (primary, backup, tertiary, joint/sole, power of sale)
- Estate Distribution (exclusions, specific gifts up to 5, company shares, life tenancy, trusts)
- Additional Provisions (SDT, guardianship, funeral, Letter of Wishes, custody)

**Transformation Strategy:**
1. **Create Client (Person Contact)**
   - Map: client_name, client_email, client_phone, client_state → Clio person contact
   - Address components required: street, city, province_state, postal_code, country
   - Return: Clio client_id (needed for matter creation)

2. **Create Matter**
   - Use returned client_id
   - Map: lead_type → practice_area
   - Map: person_responsible → responsible_attorney_id (need lawyer → attorney ID mapping)
   - Set: status = "Open", billable = true/false based on billing_type
   - Description: build from intake form summary

3. **Create Custom Fields (via Matter)**
   - Executors (primary, backup, tertiary)
   - Beneficiaries (with percentages)
   - Specific gifts (up to 5)
   - Assets (real estate, bank, superannuation)
   - Documents needed (Will, EPA, ADC, SDT)
   - Guardians (if minors)
   - Funeral preferences
   - Special Disability Trust flag

**Data Mapping Example:**
```
Form: inquiry_reason "Put a will or estate plan in place"
 → Matter: practice_area = "Estate Planning" or "Wills & Trusts"

Form: client_state "NSW"
 → Client: province_state = "New South Wales"

Form: person_responsible "Michael Brown"
 → Matter: responsible_attorney_id = (lookup from lawyers table by full_name)

Form: executor_confidence "I know exactly who"
 → Custom field: executor_primary_name, executor_primary_confidence
```

**Validation Rules:**
- Client name required (first_name + last_name)
- Email required (for contact)
- At least one address component required
- Matter requires valid client_id
- Attorney IDs must exist in Clio
- Dates must be valid YYYY-MM-DD format

**Missing from Research:**
- [ ] Custom field schema (exact API format for custom fields)
- [ ] Attorney ID mapping (how to link St Ives lawyers → Clio attorneys)
- [ ] Specific practice area options in Clio
- [ ] Matter status enum values
- [ ] Rate of API calls/throttling
- [ ] Error response codes & messages

## Authentication & Authorization

- **Supabase Auth**: Email/password sign-up
- **Sign-up Flow**:
  - New user creates account
  - Selects name from LAWYERS dropdown
  - Upserts lawyer record (creates if new, updates email if exists)
  - Sets is_admin: false
- **Role Check**: is_admin field (admin-only actions like Qualify)
- **Data Filtering**: Lawyers see only forms/leads assigned to their lawyer_id

## Recent Changes & Fixes

### Session 2026-09-09

1. **Early-Exit Handling** (lead-inquiry.html)
   - Non-qualifying Q1 answers now save partial form data (Q1-Q2)
   - Team can see reason & contact info for direct outreach
   - Shows "Thanks — we'll be in touch" message

2. **Delete Button** (DashboardV2.tsx)
   - ✅ Working in Appointment Sent column
   - ✅ Working in Scheduled column
   - ❌ Disabled in all other columns
   - Added deleteForm() function to dashboard-actions.ts

3. **View Button** (DashboardV2.tsx)
   - ✅ Working in Appointment Sent, Scheduled, Completed Intake columns
   - ❌ Disabled in Pending Intake (form not ready)

4. **Form Display Logic** (lead-inquiry.html)
   - Shows blank form if lead_id present but no saved data
   - Shows summary if saved data found
   - Spinner briefly loads in both cases

5. **Demo Data** (Supabase)
   - Added 2 pending_intake forms
   - Added 2 completed_intake forms
   - All with valid lawyer_id references

### Previous Sessions

1. **Form Status Transitions**
   - Fixed: Only 'appointment_sent' → 'scheduled' on first submit
   - Fixed: Summary view doesn't overwrite status

2. **Pending Intake Overview**
   - Shows all incomplete forms in dashboard overview

3. **Lawyer Assignment**
   - Lookup person_responsible lawyer_id for assignment

## Known Limitations & TODOs

### Not Yet Implemented
- [ ] Intake form (Parts A-D) - Send Intake Form button disabled
- [ ] Populate Matter to Smokeball - button not shown
- [ ] Edit/Send Back buttons - not shown
- [ ] Overdue reminders (3d, 1w, 2w)
- [ ] Webhook automation (Make platform integration)
- [ ] Demo mode removed from main workflow

### Disabled Features
- View button in Pending Intake (form not ready)
- Send Intake Form button (form not implemented)
- Webhooks (awaiting Make platform setup)

### Known Issues
- None currently

### Production Checklist
- [ ] Enable RLS policies on lawyers table
- [ ] Set up Make platform webhooks
- [ ] Implement intake form (Parts A-D)
- [ ] Add Smokeball submission workflow
- [ ] Enable email confirmations
- [ ] Test full end-to-end workflow
- [ ] Set admin account creation process

## Setup Notes

- **Logo**: Expects logo file in public directory
- **Environment**: VITE_WEBHOOK_URL, VITE_SEND_FORM_EMAIL_WEBHOOK, etc.
- **RLS**: Currently disabled on lawyers table (needs policy setup)
- **Form Links**: Clean URLs via /api/ routes (Vercel rewrite configured)
- **Git**: client-relations user for deployment access
