-- Insert test pending leads into screening_submissions
-- Run this in Supabase SQL Editor

-- First, get a lawyer ID (adjust if needed based on your lawyers table)
-- This assumes you have at least one lawyer in the database

INSERT INTO public.screening_submissions (
  lawyer_id,
  contact_type,
  contact_data,
  lead_type,
  region,
  person_responsible,
  referral_type,
  billing_type,
  status,
  created_at,
  updated_at
) VALUES
(
  (SELECT id FROM public.lawyers LIMIT 1),
  'person',
  jsonb_build_object(
    'name', 'John Smith',
    'email', 'john.smith@example.com',
    'mobile', '0412 345 678',
    'title', 'Mr'
  ),
  'Estate Planning',
  'NSW',
  'John Smith',
  'Accountant',
  'Hourly',
  'pending',
  NOW(),
  NOW()
),
(
  (SELECT id FROM public.lawyers LIMIT 1),
  'person',
  jsonb_build_object(
    'name', 'Sarah Johnson',
    'email', 'sarah.johnson@example.com',
    'mobile', '0487 654 321',
    'title', 'Mrs'
  ),
  'Estate Planning',
  'VIC',
  'Emma Taylor',
  'Referral',
  'Fixed',
  'pending',
  NOW(),
  NOW()
),
(
  (SELECT id FROM public.lawyers LIMIT 1),
  'firm',
  jsonb_build_object(
    'organisationName', 'ABC Financial Services',
    'organisationEmail', 'info@abcfinancial.com.au',
    'organisationPhone', '(02) 9999 8888',
    'contactName', 'Michael Brown',
    'contactEmail', 'michael@abcfinancial.com.au',
    'businessRole', 'Financial Advisor'
  ),
  'Referral',
  'QLD',
  'Michael Brown',
  'Referral',
  'Hourly',
  'pending',
  NOW(),
  NOW()
);

-- Verify the data was inserted
SELECT id, contact_type, contact_data->>'name' as name,
       contact_data->>'email' as email, person_responsible, status
FROM public.screening_submissions
WHERE status = 'pending'
ORDER BY created_at DESC
LIMIT 10;
