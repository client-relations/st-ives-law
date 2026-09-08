# Nautlius Form Dashboard - Setup Guide

## ✅ What's Built

### Foundation
- ✅ **Supabase Database Schema** (SQL file in root)
- ✅ **Form Routing** (Dashboard vs Form view based on URL)
- ✅ **Dashboard Component** with 3 tabs:
  - 🟡 Pending Intake (not started + in progress)
  - 🟢 Completed (ready for lawyer review)
  - 🚀 Submitted (sent to Smokeball)
- ✅ **Form Integration**
  - Load from URL parameter `?formId=xxx`
  - Auto-save to Supabase every 3 seconds
  - Changed button: "Submit Questionnaire" → "Mark as Complete"
  - Progress tracking automatic
- ✅ **Lawyer Review**
  - "Send to Smokeball" button in Completed tab
  - Triggers webhook to Make workflow
  - Updates form status to "submitted"

### Files Created
```
src/
├── lib/supabase.ts                 # Supabase client setup
├── hooks/useSupabaseForms.ts       # Form CRUD operations
├── hooks/useAutoSaveSupabase.ts    # Auto-save logic
├── pages/Dashboard.tsx              # Dashboard UI
├── pages/Dashboard.tsx              # Dashboard with tabs & Send button
├── styles/dashboard.css             # Dashboard styling
├── AppRouter.tsx                    # Routes between Dashboard/Form
└── utils/calculateProgress.ts       # Progress calculation

Root/
├── supabase_schema.sql              # Database schema (run in Supabase)
├── SETUP_GUIDE.md                   # This file
└── IMPLEMENTATION_PLAN.md           # Original plan
```

---

## 🚀 Next Steps (3 Required)

### Step 1: Supabase Setup (5 minutes)
1. Go to **supabase.com** and create free account
2. Create new project (copy the project URL & API key)
3. Go to SQL editor → paste contents of `supabase_schema.sql` → Run

### Step 2: Environment Variables
Create/update `.env.local` in `artifacts/questionnaire/`:
```
VITE_SUPABASE_URL=your_project_url_here
VITE_SUPABASE_ANON_KEY=your_anon_key_here
VITE_WEBHOOK_URL=https://hook.eu2.make.com/fou12e2mjy2wgv2h0e3jgqor7fu81rec
```

### Step 3: Install UUID Package
```bash
cd artifacts/questionnaire
pnpm add uuid
pnpm add -D @types/uuid
```

### Step 4: Start the Dev Server
```bash
pnpm run dev
```

Navigate to:
- **Dashboard:** http://localhost:3000
- **Form:** http://localhost:3000/?formId=xxx (auto-generated)

---

## 📋 User Flows

### Client Flow
1. Lawyer generates form on Dashboard → "Create New Form"
2. System creates unique link: `http://localhost:3000/?formId=abc123`
3. Lawyer shares link with client
4. Client fills form (auto-saves every 3 seconds)
5. Client clicks "Mark as Complete"
6. Form appears in "Completed" tab on Dashboard

### Lawyer Flow
1. Dashboard shows "Pending Intake" tab (all in-progress forms)
2. Reviews client's completed form (or opens form to review)
3. Clicks "Send to Smokeball" button
4. Webhook fires → Matter created in Smokeball
5. Form moves to "Submitted" tab

---

## 🔄 Form Status Flow

```
CREATE
  ↓
PENDING (0%) — Form created, not opened
  ↓
PENDING (1-99%) — Client filling it out
  ↓
COMPLETED (100%) — Client marked complete, awaiting lawyer review
  ↓
SUBMITTED — Lawyer sent to Smokeball
```

---

## 📊 Database Schema

### forms table
- `id` UUID primary key
- `client_name` TEXT
- `status` 'pending' | 'completed' | 'submitted'
- `progress_pct` 0-100
- `form_data` JSONB (stores all form fields)
- `unique_link` TEXT (shared with client)
- `created_at`, `last_accessed`, `marked_complete_at`, `submitted_at`

### submissions table
- `id` UUID
- `form_id` UUID (foreign key)
- `status` 'pending' | 'sent' | 'failed'
- `webhook_url` TEXT
- `response_data` JSONB (response from Make)

---

## 🧪 Testing Checklist

### Dashboard
- [ ] Create new form → see unique link
- [ ] Copy link → paste in browser
- [ ] Form loads with correct formId
- [ ] Pending Intake tab shows in-progress forms
- [ ] Completed tab shows 100% forms
- [ ] Progress % updates in real-time

### Form
- [ ] Load form by URL parameter
- [ ] Fill some fields → "Last saved" timestamp appears
- [ ] Close browser → reload URL → data restored
- [ ] Click "Mark as Complete" → Form moves to Completed tab
- [ ] "Send to Smokeball" button appears in Completed tab

### Webhook
- [ ] Lawyer clicks "Send to Smokeball"
- [ ] Webhook fires to Make
- [ ] Matter created in Smokeball
- [ ] Form status changes to "Submitted"

---

## 📝 Environment Notes

### Development
- Uses local Supabase (free tier)
- Real-time updates via Supabase subscriptions
- All form data in cloud (not localStorage)

### Production
- Use Supabase paid tier for reliability
- Configure RLS policies for security
- Add authentication (email/password or OAuth)
- Use signed URLs for private form links

---

## 🔐 Security (Future)

Currently public access to forms. For production:
1. Add Supabase Auth (email/password)
2. Implement RLS policies
3. Use signed/time-limited URLs
4. Add user roles (client, lawyer, admin)

---

## ⚠️ Known Issues / TODOs

- [ ] Add error handling UI (network, upload failures)
- [ ] Add loading states for slow connections
- [ ] Add email notifications when form completed
- [ ] Add file upload support (currently disabled)
- [ ] Add PDF generation for submitted forms
- [ ] Add form templates/reusable drafts
- [ ] Add bulk form creation for multiple clients

---

## 🎯 Success Criteria

✅ When you can:
1. Create form on Dashboard
2. Fill it out via shared link
3. See "Last saved" timestamp
4. Lawyer reviews and sends to Smokeball
5. Webhook fires and form status updates

Then we've achieved the goal! 🎉

---

## 💬 Questions?

Reference these files:
- `IMPLEMENTATION_PLAN.md` - Architecture overview
- `supabase_schema.sql` - Database structure
- `src/hooks/useSupabaseForms.ts` - All API operations
- `src/AppRouter.tsx` - Routing logic

