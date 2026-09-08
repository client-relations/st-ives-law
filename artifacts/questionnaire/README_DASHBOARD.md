# St Ives Law Lawyer Dashboard

A comprehensive dashboard system for managing client leads, screening forms, and intake questionnaires with multi-role access control and real-time updates.

## Features

### 1. **Authentication & Authorization**
- Secure email/password authentication via Supabase Auth
- Role-based access control (Lawyer vs Admin)
- Session management with automatic logout
- User profile display with role badges

### 2. **Dashboard Overview**
- **Pending Leads**: Count and quick access to new screening submissions
- **Pending Intake Forms**: In-progress questionnaires with progress tracking
- **Completed Forms**: Ready-to-review submissions
- All with filtering by name, person responsible, and date range

### 3. **Lead Management (Screening)**
- Internal lead creation via modal form
- Support for individual and business contact types
- Comprehensive fields: lead type, region, referral source, billing type
- Automatic assignment to responsible lawyer
- Lead qualification workflow (Qualify → Reject → Deprioritize)

### 4. **Intake Workflow (Kanban)**
Two separate Kanban views:

**Pending Leads (Tabs):**
- Pending: New screening submissions
- Deprioritized: Rejected or low-priority leads

**Qualified Leads (Columns):**
- In Progress: Forms being completed
- Completed: 100% filled forms
- Submitted to Smokeball: Sent to law firm system
- Overdue: Delayed forms with urgency indicators

### 5. **External Form Access**
- Unique shareable links with token validation
- External clients can access questionnaire without login
- Secure token-based form access

### 6. **Admin Features**
- View all leads and forms across the organization
- Admin badge in header
- Bypass single-lawyer filtering
- Manage all user data

## Tech Stack

- **Frontend**: React 18 + TypeScript
- **Styling**: Vanilla CSS with design tokens
- **Backend**: Supabase (PostgreSQL + Auth)
- **State Management**: React Context API
- **Form Handling**: React hooks with validation
- **Real-time**: Supabase subscriptions (ready for implementation)

## Getting Started

### Prerequisites
- Node.js 16+ and npm/yarn
- Supabase project (free tier available at supabase.com)
- Environment variables configured

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

### Environment Setup

Create `.env.local` with:
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### Database Setup

1. Create tables (see schema below)
2. Enable RLS on all tables
3. Apply RLS policies (see `docs/RLS_POLICIES.md`)
4. Seed initial lawyer accounts

## File Structure

```
src/
├── pages/
│   ├── DashboardV2.tsx          # Main dashboard
│   ├── ScreeningFormV2.tsx      # Internal screening form (modal)
│   └── LoginPage.tsx             # Login/signup page
├── context/
│   └── AuthContext.tsx           # Auth state and user session
├── lib/
│   ├── supabase.ts               # Supabase client
│   ├── dashboard-actions.ts      # Lead/form operations
│   └── screening-link-generator.ts # Token generation
├── constants/
│   └── colors.ts                 # Design tokens
└── App.tsx                        # Main questionnaire form
```

## Database Schema

### lawyers
```sql
CREATE TABLE lawyers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  full_name text NOT NULL,
  is_admin boolean DEFAULT false,
  created_at timestamp DEFAULT now()
);
```

### screening_submissions
```sql
CREATE TABLE screening_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lawyer_id uuid REFERENCES lawyers(id),
  unique_screening_token text UNIQUE,
  client_name text,
  client_email text,
  contact_type text,
  lead_type text,
  region text,
  referral_type text,
  billing_type text,
  person_responsible text,
  status text DEFAULT 'pending',
  created_at timestamp DEFAULT now(),
  submitted_at timestamp
);
```

### forms
```sql
CREATE TABLE forms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lawyer_id uuid REFERENCES lawyers(id),
  screening_id uuid REFERENCES screening_submissions(id),
  client_name text,
  client_email text,
  status text DEFAULT 'in_progress',
  progress_pct integer DEFAULT 0,
  form_data jsonb DEFAULT '{}',
  form_type text DEFAULT 'estate_planning',
  unique_link text UNIQUE,
  created_at timestamp DEFAULT now(),
  marked_complete_at timestamp,
  submitted_at timestamp
);
```

## Key Actions

### Qualify Lead
```typescript
// Converts screening → creates form → updates status
await qualifyLead(screeningId, lawyerId);
```

### Reject Lead
```typescript
// Updates status to 'rejected'
await rejectLead(screeningId);
```

### Complete Form
```typescript
// Sets status to 'completed' and progress to 100%
await markFormComplete(formId);
```

### Submit to Smokeball
```typescript
// Sets status to 'submitted' and records timestamp
await submitFormToSmokeball(formId);
```

## User Roles

### Regular Lawyer
- View own pending leads
- Create new screenings
- View own forms
- Update own forms
- See own dashboard metrics

### Admin Lawyer
- View ALL leads and forms
- Create screenings (assigned to self)
- Manage other lawyers' data
- Admin badge in header
- Global dashboard visibility

## Access Control

Access is controlled at two levels:

1. **Frontend Filtering**: UI respects user role
2. **Database RLS**: Policies enforce access at database layer

Regular lawyers see only their data:
```sql
WHERE lawyer_id = (SELECT id FROM lawyers WHERE email = auth.jwt()->>'email')
```

Admins see everything:
```sql
WHERE is_admin = true OR lawyer_id = (SELECT id FROM lawyers WHERE email = auth.jwt()->>'email')
```

## Workflows

### Complete Lead Intake

1. **Day 1**: Lawyer creates screening → Adds client info → Saves
2. **Day 1**: Admin/Lawyer qualifies lead → Creates form entry
3. **Day 3**: System sends form link to client
4. **Day 4-5**: Client fills questionnaire and submits
5. **Day 6**: Lawyer reviews and marks complete
6. **Day 7**: Lawyer sends to Smokeball CRM

### Lead Rejection

1. Lawyer reviews new lead
2. Clicks "Reject" if not suitable
3. Lead marked as rejected
4. Appears in "Deprioritized" tab

## Customization

### Adding New Fields to Screening Form

1. Edit `ScreeningFormV2.tsx` - add to form state
2. Update `dashboard-actions.ts` - add to INSERT payload
3. Update database schema - add column to `screening_submissions`
4. Run migration in Supabase

### Changing Colors

Edit `src/constants/colors.ts`:
```typescript
export const C = {
  teal: '#1BA098',      // Primary action color
  green: '#27AE60',     // Success/positive
  warm: '#E8944A',      // Warning/secondary action
  charcoal: '#2C3E50',  // Text color
  // ... etc
};
```

## Performance Considerations

- Dashboard fetches all forms on mount (consider pagination for large datasets)
- Action buttons trigger full data refresh (could use optimistic updates)
- Consider implementing Supabase real-time subscriptions for live updates
- Add request debouncing for search/filters

## Security Notes

1. **Never commit .env files**
2. **Enable HTTPS in production**
3. **Apply all RLS policies** before production use
4. **Regularly review logs** for suspicious activity
5. **Rotate API keys** periodically
6. **Backup database** before major changes

## Troubleshooting

### "Database connection error"
- Check `.env.local` for correct Supabase URL and key
- Verify Supabase project is active
- Check browser console for CORS errors

### "Not authorized" on dashboard
- Verify lawyer record exists in `lawyers` table
- Check RLS policies are applied correctly
- Ensure lawyer's email matches auth user

### Forms not appearing
- Check `lawyer_id` in forms table matches current user
- Verify status values match filter logic
- Check for data loading errors in console

## Contributing

When adding features:
1. Update relevant documentation
2. Add error handling and loading states
3. Test with both lawyer and admin accounts
4. Consider mobile responsiveness
5. Update changelog

## Deployment

See `docs/INTEGRATION_GUIDE.md` for full deployment checklist.

Quick steps:
1. Set production environment variables
2. Run database migrations
3. Apply RLS policies
4. Create admin user account
5. Deploy frontend to hosting (Vercel, Netlify, etc.)
6. Test all user flows
7. Configure email notifications
8. Set up monitoring/logging

## Future Enhancements

- [ ] Real-time Kanban updates via Supabase subscriptions
- [ ] Email notifications for new forms/updates
- [ ] Mobile app version
- [ ] Form templates and quick-fill
- [ ] Advanced reporting and analytics
- [ ] Smokeball CRM integration
- [ ] Document generation
- [ ] Video call integration for consultations
- [ ] Audit trail/version history

## Support & Documentation

- **RLS Policies**: See `docs/RLS_POLICIES.md`
- **Integration**: See `docs/INTEGRATION_GUIDE.md`
- **Architecture**: See commit messages and inline code comments
- **Questions**: Review code comments and git history

## License

Proprietary - Nautilus Law

---

**Last Updated**: 2026-08-24  
**Status**: Phase 2 Backend Complete - Ready for Testing
