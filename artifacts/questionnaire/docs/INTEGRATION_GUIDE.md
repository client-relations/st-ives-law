# Nautilus Law Dashboard - Integration Guide

## System Overview

This guide explains how all components work together.

## User Flows

### 1. Lawyer Login & Dashboard

1. Lawyer navigates to `/login`
2. Enters email/password (authenticated via Supabase Auth)
3. AuthContext fetches lawyer record from `lawyers` table
4. Lawyer sees dashboard with:
   - Overview of pending leads and forms
   - Kanban view of qualified leads
   - Admin badge if `is_admin = true`

### 2. Creating a Lead (Internal Screening)

1. Lawyer clicks "+ New Screening" button
2. ScreeningFormV2 modal opens
3. Lawyer fills in client info (person or firm)
4. Form saves to `screening_submissions` table with:
   - `lawyer_id` = current lawyer's ID
   - `status` = 'pending'
   - `contact_type` = 'person' or 'firm'

### 3. Qualifying a Lead

1. Lawyer clicks "Qualify" on a pending lead card
2. System creates new entry in `forms` table:
   - `lawyer_id` = lead's lawyer_id
   - `screening_id` = reference to screening
   - `status` = 'in_progress'
   - `progress_pct` = 0
3. Lead moves to "In Progress" Kanban column

### 4. External Client Form Access

**Current Status**: Partial implementation

1. Lawyer has form link (currently placeholder)
2. Client clicks link: `/?screeningLink=<unique_screening_token>`
3. AppRouter validates token against `screening_submissions` table
4. If valid, App.tsx (questionnaire) loads
5. Client fills out detailed questionnaire
6. **TODO**: Connect form submission to save in `forms.form_data`

### 5. Form Submission Workflow

1. Lawyer receives completed form
2. Reviews and marks as "Complete" (100% progress)
3. Clicks "Send" to submit to Smokeball
4. Form status changes to "submitted"

### 6. Admin Access

- Admins (with `is_admin = true`) see all leads/forms
- Admins can manage all lawyers' data
- Regular lawyers see only their own data
- Enforced by RLS policies (when enabled)

## Database Schema

### lawyers
- `id` (UUID)
- `email` (unique)
- `full_name`
- `is_admin` (boolean)
- `created_at`

### screening_submissions
- `id` (UUID)
- `lawyer_id` (foreign key)
- `unique_screening_token` (for external access)
- `client_name`
- `client_email`
- `contact_type` ('person' or 'firm')
- `lead_type`
- `region`
- `referral_type`
- `billing_type`
- `person_responsible`
- `status` ('pending', 'qualified', 'rejected', 'deprioritized')
- `created_at`
- `submitted_at`

### forms
- `id` (UUID)
- `lawyer_id` (foreign key)
- `screening_id` (foreign key, optional)
- `client_name`
- `client_email`
- `status` ('in_progress', 'completed', 'submitted', 'overdue')
- `progress_pct` (0-100)
- `form_data` (JSON, questionnaire answers)
- `form_type` (e.g., 'estate_planning')
- `unique_link` (old system, deprecate)
- `created_at`
- `marked_complete_at`
- `submitted_at`

## Authentication Flow

1. Supabase Auth handles user signup/login
2. AuthContext manages session state
3. AuthContext fetches lawyer record on login
4. Lawyer data passed to all components via useAuth hook
5. RLS policies enforce data access at database level

## Component Structure

```
AppRouter
├── LoginPage (public)
├── ScreeningFormV2 (public, modal in dashboard)
├── DashboardV2 (protected)
│   ├── Overview (3-column layout)
│   ├── Pending Leads (Kanban)
│   └── Qualified Leads (Kanban)
└── App.tsx / Questionnaire (semi-public, token-protected)
```

## TODO / Remaining Work

### High Priority
- [ ] Apply RLS policies to database
- [ ] Test external form access with screening tokens
- [ ] Connect questionnaire submission to forms table
- [ ] Create admin user management page
- [ ] Add form review/edit modal

### Medium Priority
- [ ] Add email notifications for new forms
- [ ] Implement form progress tracking UI
- [ ] Add notes/comments on forms
- [ ] Create audit log for all changes
- [ ] Add Smokeball API integration for actual submission

### Low Priority
- [ ] Mobile responsive design
- [ ] Dark mode
- [ ] Export forms to PDF
- [ ] Batch operations (export multiple)
- [ ] Advanced filtering and search

## Deployment Checklist

Before going live:
- [ ] Enable RLS on all tables
- [ ] Create admin user account
- [ ] Test all user flows end-to-end
- [ ] Configure Supabase environment variables
- [ ] Set up email notifications
- [ ] Backup database
- [ ] Create support documentation
- [ ] Train lawyers on new system

## Security Notes

1. **Authentication**: Supabase Auth handles passwords securely
2. **RLS Policies**: Prevent unauthorized data access at DB level
3. **Screening Tokens**: UUID tokens for external form access (add expiration later)
4. **Admin Override**: Admins can bypass RLS (use carefully)
5. **Client Data**: PII stored only in screening_submissions/forms, not logs

## Support

For issues or questions:
1. Check RLS_POLICIES.md for access control questions
2. Review component code for implementation details
3. Check git commit messages for change history
