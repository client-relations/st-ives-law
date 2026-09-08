-- ============================================
-- RESET & SEED - Delete all old data, inject dummy data
-- Run this in Supabase SQL Editor
-- ============================================

-- 1. DELETE ALL OLD DATA
DELETE FROM forms;
DELETE FROM screening_submissions;

-- 2. INSERT TEST SCREENING SUBMISSIONS (Pending Leads)
INSERT INTO screening_submissions (
  lawyer_id,
  client_name,
  client_email,
  contact_type,
  lead_type,
  region,
  referral_type,
  billing_type,
  person_responsible,
  status,
  created_at
)
VALUES
  (
    'demo-lawyer-id',
    'John Smith',
    'john.smith@example.com',
    'person',
    'Estate Planning',
    'NSW',
    'Word of Mouth',
    'Fixed Fee',
    'Colin Long',
    'pending',
    NOW() - INTERVAL '2 days'
  ),
  (
    'demo-lawyer-id',
    'Sarah Johnson',
    'sarah.johnson@example.com',
    'person',
    'Family Law',
    'VIC',
    'Referral',
    'Time Based',
    'Emma Mathieson',
    'pending',
    NOW() - INTERVAL '1 day'
  ),
  (
    'demo-lawyer-id',
    'Mike Brown',
    'mike.brown@example.com',
    'firm',
    'Corporate Law',
    'QLD',
    'Direct',
    'Fixed Fee Per Appearance',
    'Katrina Elizabeth Brown',
    'pending',
    NOW()
  ),
  (
    'demo-lawyer-id',
    'Jennifer Lee',
    'jennifer.lee@example.com',
    'person',
    'Property Law',
    'NSW',
    'Google',
    'Contingency (%)',
    'Sarah Tait',
    'pending',
    NOW() - INTERVAL '3 hours'
  );

-- 4. INSERT TEST FORMS (Qualified Leads)
INSERT INTO forms (
  lawyer_id,
  screening_id,
  client_name,
  client_email,
  status,
  progress_pct,
  form_data,
  form_type,
  created_at,
  marked_complete_at
)
VALUES
  (
    'demo-lawyer-id',
    NULL,
    'Alice Chen',
    'alice.chen@example.com',
    'in_progress',
    45,
    '{"step": "section_b"}',
    'estate_planning',
    NOW() - INTERVAL '5 days',
    NULL
  ),
  (
    'demo-lawyer-id',
    NULL,
    'Bob Wilson',
    'bob.wilson@example.com',
    'in_progress',
    78,
    '{"step": "section_d"}',
    'estate_planning',
    NOW() - INTERVAL '3 days',
    NULL
  ),
  (
    'demo-lawyer-id',
    NULL,
    'Carol Davis',
    'carol.davis@example.com',
    'completed',
    100,
    '{"step": "complete"}',
    'estate_planning',
    NOW() - INTERVAL '7 days',
    NOW() - INTERVAL '1 day'
  ),
  (
    'demo-lawyer-id',
    NULL,
    'David Miller',
    'david.miller@example.com',
    'submitted',
    100,
    '{"step": "complete"}',
    'estate_planning',
    NOW() - INTERVAL '10 days',
    NOW() - INTERVAL '8 days'
  ),
  (
    'demo-lawyer-id',
    NULL,
    'Emma White',
    'emma.white@example.com',
    'overdue',
    25,
    '{"step": "section_a"}',
    'estate_planning',
    NOW() - INTERVAL '15 days',
    NULL
  ),
  (
    'demo-lawyer-id',
    NULL,
    'Frank Green',
    'frank.green@example.com',
    'overdue',
    40,
    '{"step": "section_b"}',
    'estate_planning',
    NOW() - INTERVAL '8 days',
    NULL
  );

-- ============================================
-- DONE!
-- ============================================
-- Pending Leads: 4 created
-- Forms: 6 created (2 in progress, 1 completed, 1 submitted, 2 overdue)
