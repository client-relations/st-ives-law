# Quick Start Guide - St Ives Law Dashboard

Get the dashboard up and running in 5 minutes.

## 1. Prerequisites

- Node.js 16+ installed
- Supabase account (free at supabase.com)
- Git installed

## 2. Setup Supabase

1. Go to [supabase.com](https://supabase.com) and create a new project
2. In Project Settings → API, copy:
   - Project URL → `VITE_SUPABASE_URL`
   - Anon Key → `VITE_SUPABASE_ANON_KEY`

3. Run these SQL queries in Supabase SQL editor:

```sql
-- Create tables
CREATE TABLE lawyers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  full_name text NOT NULL,
  is_admin boolean DEFAULT false,
  created_at timestamp DEFAULT now()
);

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

CREATE TABLE forms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lawyer_id uuid REFERENCES lawyers(id),
  screening_id uuid REFERENCES screening_submissions(id),
  client_name text,
  client_email text,
  status text DEFAULT 'in_progress',
  progress_pct integer DEFAULT 0,
  form_data jsonb DEFAULT '{}',
  form_type text,
  unique_link text UNIQUE,
  created_at timestamp DEFAULT now(),
  marked_complete_at timestamp,
  submitted_at timestamp
);

-- Create seed lawyer (change email)
INSERT INTO lawyers (email, full_name, is_admin)
VALUES ('your-email@example.com', 'Your Name', true);
```

## 3. Clone & Install

```bash
# Clone the repo
git clone <repo-url>
cd questionnaire

# Install dependencies
npm install

# Create .env.local file with your Supabase credentials
echo 'VITE_SUPABASE_URL=https://xxxx.supabase.co' > .env.local
echo 'VITE_SUPABASE_ANON_KEY=xxxx' >> .env.local
```

## 4. Run Dev Server

```bash
npm run dev
```

Visit http://localhost:5173

## 5. First Login

1. Go to `/login`
2. Create account with email from Step 2
3. Click dashboard - should load your profile

## 6. Try Key Features

### Create a Screening
1. Click "+ New Screening" button
2. Fill in client info (name, email, region, etc.)
3. Click Submit

### Qualify a Lead
1. See your new lead in "Pending Leads"
2. Click "Qualify" button
3. Lead moves to "Qualified Leads" → "In Progress"

### View as Admin

If you set `is_admin = true` in database:
- Dashboard shows all lawyers' leads
- Can manage all forms
- Admin badge appears in header

### Test External Form (Future)

Once integrated:
1. Copy screening token from database
2. Open `/?screeningLink=TOKEN`
3. See questionnaire form (no login required)

## 7. Deploy (Optional)

### Vercel (Recommended)
```bash
npm i -g vercel
vercel
# Follow prompts, set env vars in Vercel dashboard
```

### Netlify
1. Push to GitHub
2. Connect repo to Netlify
3. Set environment variables
4. Deploy

## Common Tasks

### Add More Lawyer Users

```sql
INSERT INTO lawyers (email, full_name, is_admin)
VALUES ('lawyer2@example.com', 'Second Lawyer', false);
```

User can then signup with this email, and record will link automatically.

### Reset Password

Supabase Auth handles this - use "Forgot Password" on login page.

### View Your Data

Go to Supabase Dashboard → Table Editor:
- See screening_submissions
- See forms
- See lawyers

### Debug Issues

Check browser console (F12) for errors:
- Auth errors = check .env.local
- Database errors = check table names match
- Component errors = check Supabase connection

## Next Steps

1. **Apply RLS policies** from `docs/RLS_POLICIES.md` for security
2. **Invite team members** - add them to lawyers table
3. **Customize fields** - edit ScreeningFormV2.tsx as needed
4. **Set up emails** - configure Supabase email templates
5. **Test workflows** - create sample leads end-to-end

## Support

- **Error**: "Database connection error" → Check .env.local
- **Error**: "Not found" → Check table names in SQL
- **Error**: "Auth failed" → Try signing up instead of login
- **Questions**: Check README_DASHBOARD.md and git commits

## Performance Tips

- Use Supabase free tier for testing
- Upgrade to paid if > 5 concurrent users
- Monitor database queries in Supabase dashboard
- Add indexes if queries slow down

## Production Checklist

Before sharing with team:
- [ ] .env.local has production Supabase project
- [ ] RLS policies applied to all tables
- [ ] Test login/logout cycle
- [ ] Test create screening → qualify → complete flow
- [ ] HTTPS enabled (auto on Vercel/Netlify)
- [ ] Backup database configured
- [ ] Team members added to lawyers table
- [ ] Docs shared with team

## Ready to Start?

1. Follow steps 1-4 above ✓
2. Create first screening ✓
3. Explore dashboard ✓
4. Read docs/INTEGRATION_GUIDE.md for deep dive ✓
5. Customize for your firm ✓

**Estimated time: 10 minutes**

Need help? Check the full README_DASHBOARD.md for troubleshooting.

---

Happy lawyering! 🏛️
