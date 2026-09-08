# Form Dashboard & Tracking Implementation Plan

## Overview
Transform the questionnaire from single-session form to a multi-client form management system with Supabase backend.

## Architecture

### 1. Supabase Database Schema

```sql
-- Forms table (one per client/session)
CREATE TABLE forms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users,
  form_type TEXT, -- "estate_planning", etc.
  client_name TEXT NOT NULL,
  client_email TEXT,
  status TEXT DEFAULT 'in_progress', -- 'in_progress', 'pending_review', 'submitted'
  progress_pct INT DEFAULT 0, -- 0-100
  created_at TIMESTAMP DEFAULT NOW(),
  last_accessed TIMESTAMP DEFAULT NOW(),
  submitted_at TIMESTAMP,
  form_data JSONB DEFAULT '{}'::jsonb, -- stores all fields
  unique_link TEXT UNIQUE
);

-- Form submissions (final snapshots sent to Make/Smokeball)
CREATE TABLE submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id UUID REFERENCES forms(id),
  submitted_by UUID REFERENCES auth.users,
  status TEXT DEFAULT 'pending', -- 'pending', 'sent', 'failed'
  webhook_url TEXT,
  response JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  sent_at TIMESTAMP
);

-- Row Level Security (RLS) policies
ALTER TABLE forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;
```

### 2. Form Structure Changes

**Current Flow:**
```
Form (localStorage sessionId) → Webhook on Submit
```

**New Flow:**
```
Dashboard (Create Form) → Unique URL with formId → Auto-save to Supabase → 
→ Lawyer reviews → "Send to Smokeball" button → Webhook + PDF generation
```

### 3. Components to Build

#### A. Dashboard (`/dashboard`)
- [ ] List all forms (with client name, progress %, status)
- [ ] Filter by: in_progress, pending_review, submitted
- [ ] "Create New Form" button
  - Input: client name, email, form type
  - Output: unique link to share
- [ ] Copy link to clipboard
- [ ] View form progress details
- [ ] Status badge (Open / Partially Filled / Completed)

#### B. Form Modifications
- [ ] Load form data from URL parameter `?formId=xxx`
- [ ] Replace localStorage with Supabase real-time subscription
- [ ] Auto-save to Supabase every 3 seconds (instead of localStorage)
- [ ] Add progress tracking (calculate % based on filled fields)
- [ ] Replace "Submit Questionnaire" with "Mark as Complete"
- [ ] Show "Last saved" timestamp

#### C. Review Screen (for lawyer)
- [ ] View submitted form data
- [ ] "Send to Smokeball" button
- [ ] Option to attach PDF
- [ ] Status updates

### 4. API Endpoints (Supabase Auto-generated)

- `POST /forms` - Create new form instance
- `GET /forms` - List all forms
- `GET /forms/{id}` - Get specific form with progress
- `PATCH /forms/{id}` - Update form data (auto-save)
- `POST /forms/{id}/complete` - Mark form as complete
- `POST /submissions` - Create submission record
- `POST /submissions/{id}/send` - Trigger webhook to Make + Smokeball

### 5. Progress Calculation

```javascript
// Calculate progress based on filled fields
function calculateProgress(formData) {
  const totalFields = getTotalFieldCount(); // ~150 fields across all parts
  const filledFields = countFilledFields(formData);
  return Math.round((filledFields / totalFields) * 100);
}
```

### 6. Webhook Integration

**Current:** Form submits directly to Make
**New:** Form marks complete → Lawyer reviews → Lawyer clicks "Send to Smokeball" → Webhook fires

```javascript
// When lawyer clicks "Send to Smokeball"
async function sendToSmokeball(formId) {
  const formData = await getFormData(formId);
  const payload = buildFinalPayload(formData);
  await fetch(WEBHOOK_URL, {
    method: 'POST',
    body: JSON.stringify({...payload, reviewed: true, reviewer_id: currentUser.id})
  });
  // Update submission status
  await updateSubmissionStatus(formId, 'sent');
}
```

## Implementation Phases

### Phase 1: Database Setup (Today)
- [ ] Create Supabase project
- [ ] Create tables (forms, submissions)
- [ ] Set up RLS policies
- [ ] Create Supabase client in React

### Phase 2: Dashboard UI (Today/Tomorrow)
- [ ] Dashboard component
- [ ] Create form modal
- [ ] List forms with progress
- [ ] Copy link functionality

### Phase 3: Form Integration (Tomorrow)
- [ ] Load from URL parameter
- [ ] Replace localStorage with Supabase
- [ ] Auto-save to Supabase
- [ ] Progress tracking

### Phase 4: Submission Flow (Tomorrow)
- [ ] "Mark as Complete" button
- [ ] "Send to Smokeball" button
- [ ] Webhook integration
- [ ] Status tracking

## Current Form Fields

The form has 4 parts (A, B, C, D) with ~150 total fields covering:
- Part A: Identity, assets, family
- Part B: Business, insurance, accountant
- Part C: Wills, executors, guardians, distribution
- Part D: EPA, funeral, legal details

Each can be independently filled and saved.

## Key Differences from Current System

| Current | New |
|---------|-----|
| Single session per device (localStorage) | Multiple forms per user (Supabase) |
| Submit directly to Make | Mark complete, then lawyer sends to Smokeball |
| Tracked by sessionId | Tracked by formId + unique link |
| No progress visibility | Real-time progress % |
| No form list | Dashboard shows all forms |
| No review step | Lawyer reviews before sending |
