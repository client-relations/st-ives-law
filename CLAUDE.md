# St Ives Law Lawyer Dashboard

**Purpose**: Multi-lawyer intake management system for St Ives Law. Tracks client screening, lead qualification, intake form completion, document generation, and PDF preview.

**Current Date**: 2026-09-17

## Project Overview

A React-based dashboard for lawyers to manage client intake from screening through intake form completion and DOCX document generation. Supports multi-role access (lawyer vs admin), webhook integration for form submissions and email confirmations, and real-time data sync with Supabase backend.

### Key Features

1. **Inquiry Form** - Lead-inquiry.html for initial 8-question screening with early-exit handling
2. **Intake Form** - 14-step estate planning questionnaire (client, assets, executors, beneficiaries, etc.)
3. **Document Generation** - Auto-generate DOCX from intake form data + optional PDF preview
4. **Lawyer Dashboard** - View completed forms, download/preview generated documents
5. **Webhook Integration** - Form completion triggers Make.com for email confirmations
6. **Multi-Lawyer Support** - Role-based access, lawyer assignment, filtering by responsible lawyer
7. **Form Tracking** - Status workflow from inquiry through document generation
8. **PDF Preview** - View generated documents before download (requires LibreOffice)

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
├── lib/
│   ├── formToTemplateMapper.ts      (Map webhook → template variables)
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

### /api/generate-document (POST)
**Purpose**: Generate DOCX from template with filled form data

**Request**:
```json
{
  "templateType": "simple_will|single_tt_will|multi_tt_will",
  "scenario": "individual|couple",
  "client_name": "John Smith",
  "client_address": "123 Main St",
  "exec_initial_name": "Bob Brown",
  "beneficiary1": "Son Name",
  "governing_jurisdiction": "NSW",
  "form_id": "form-uuid"
}
```

**Response**:
```json
{
  "success": true,
  "documentName": "Will - Couple (single_tt_will)",
  "documentBase64": "UEsDBBQABgAI...",
  "documentPdfBase64": "JVBERi0xLjQK..." (optional, null if LibreOffice unavailable),
  "variables": {...}
}
```

### Form Webhook (Intake Form Completion)
**Purpose**: Receive completed intake form data and trigger email confirmation

**Source**: `intake-form-site/index.html` via Make.com

**Payload**: Flat JSON structure with client_first_name, executor names, beneficiaries, etc.

## Webhook Integration

### Current Implementation
- **Intake Form Completion**: Make.com webhook for email confirmations (TBD setup)
- **Data Storage**: Completed forms stored in Supabase `forms.form_data` (JSONB)
- **Document Generation**: API endpoint triggers DOCX generation with template variables

### Webhook Flow
1. Client completes 14-step intake form
2. Form posts to Make.com webhook
3. Make.com triggers confirmation email
4. Form data stored in Supabase
5. Lawyer views completed form in dashboard
6. Lawyer clicks "Generate Document"
7. API calls `/api/generate-document` with mapped template variables
8. DOCX generated and returned with optional PDF preview

### Intake Form (14 Steps)
Located at: `C:\Users\yxzu\Desktop\st ives\intake-form-site (2)\index.html`

1. Scenario & Client Details (Single/Couple, name, address, state, spouse info)
2. Assets & Liabilities (real estate, bank, superannuation, other assets)
3. Document Type (Will, EPA, Advance Care Directive, SDT)
4. Executor(s) (primary, backup, tertiary, joint/sole arrangement)
5. Exclusions (who to exclude, reason, no-contest clause)
6. Specific Gifts (repeatable items with value)
7. Company Directorship (company name, ACN, treatment)
8. Life Tenancy (life tenant, property, outgoings)
9. Residuary Estate (trust structure, beneficiaries, distribution)
10. Special Disability Trust (yes/no, beneficiary)
11. Guardianship (minor children, guardians)
12. Funeral Wishes (organ donation, burial/cremation preferences)
13. Enduring Power of Attorney (attorneys, arrangements, additional powers)
14. Letter of Wishes & Custody (signing date, storage location, register)

### Webhook Payload Structure
```json
{
  "client_first_name": "Warren",
  "client_last_name": "Coupl",
  "client_email": "warren.ocampo@lex-ops.io",
  "client_phone": "123123",
  "client_address": "test address",
  "client_state": "VIC",
  "scenario": "Couple",
  "spouse_name": "test wife",
  "executor_primary_name": "test executor",
  "executor_backup_name": "backup",
  "executor_tertiary_name": "further",
  "beneficiaries": "Beneficiaries:\n• beneficiary 1 - 90%",
  "calamity_beneficiaries": "No calamity beneficiaries",
  "has_minors": "Yes",
  "guardian_primary": "",
  "guardian_backup": "",
  "form_id": "415a7c1e-cb0b-4075-be65-d925ee1e8c41",
  "submission_date": "2026-09-12T17:58:12.893"
}
```

### Future: Clio Integration (TBD)
- Research required: Clio API authentication, custom field mapping
- Plan: n8n flow to transform form data → Clio client/matter/custom fields
- Not yet implemented

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
- [ ] Make.com webhook setup (form completion → email confirmation)
- [ ] Edited DOCX storage in Supabase
- [ ] DOCX download/preview in dashboard (currently only API endpoint)
- [ ] Clio integration (webhook to create matters)
- [ ] Email reminders (3d, 1w, 2w overdue)

### Known Issues
- PDF generation requires LibreOffice installed (gracefully falls back to DOCX only)
- Lawyer assignment workflow needs refinement

### Production Checklist
- [ ] Enable RLS policies on lawyers table
- [ ] Set up Make.com webhook for form confirmation emails
- [ ] Test document generation with actual form data
- [ ] Configure PDF generation if LibreOffice available
- [ ] Test full end-to-end workflow (form → document → download)
- [ ] Set admin account creation process

## Setup Notes

- **Logo**: Expects logo file in public directory
- **Environment**: VITE_WEBHOOK_URL, VITE_SEND_FORM_EMAIL_WEBHOOK, etc.
- **RLS**: Currently disabled on lawyers table (needs policy setup)
- **Form Links**: Clean URLs via /api/ routes (Vercel rewrite configured)
- **Git**: client-relations user for deployment access
