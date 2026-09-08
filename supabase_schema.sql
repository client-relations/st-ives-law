-- Nautlius Form Management System Schema

-- Forms table
CREATE TABLE forms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  form_type TEXT DEFAULT 'estate_planning', -- 'estate_planning', 'powers_of_attorney', 'will_succession'
  client_name TEXT NOT NULL,
  client_email TEXT,
  status TEXT DEFAULT 'pending', -- 'pending' (not started or in progress), 'completed' (100% filled), 'submitted' (sent to Smokeball)
  progress_pct INT DEFAULT 0, -- 0-100
  created_at TIMESTAMP DEFAULT NOW(),
  last_accessed TIMESTAMP DEFAULT NOW(),
  last_saved TIMESTAMP DEFAULT NOW(),
  marked_complete_at TIMESTAMP, -- When client clicked "Mark as Complete"
  submitted_at TIMESTAMP, -- When lawyer sent to Smokeball
  form_data JSONB DEFAULT '{}'::jsonb, -- Stores all form fields from Parts A, B, C, D
  unique_link TEXT UNIQUE NOT NULL,
  created_by_user_id TEXT, -- Track who created the form (optional, for multi-user support later)
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Submissions table - tracks when forms are sent to Smokeball
CREATE TABLE submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id UUID NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending', -- 'pending', 'sent', 'failed'
  submitted_by_user_id TEXT, -- Lawyer who sent it
  webhook_url TEXT,
  response_data JSONB, -- Response from Make webhook
  error_message TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  sent_at TIMESTAMP
);

-- Enable Row Level Security
ALTER TABLE forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;

-- Create indexes for performance
CREATE INDEX idx_forms_status ON forms(status);
CREATE INDEX idx_forms_progress ON forms(progress_pct);
CREATE INDEX idx_forms_created_at ON forms(created_at DESC);
CREATE INDEX idx_forms_unique_link ON forms(unique_link);
CREATE INDEX idx_submissions_form_id ON submissions(form_id);
CREATE INDEX idx_submissions_status ON submissions(status);

-- Optional: Create a view for pending intake forms
CREATE VIEW pending_intake_forms AS
SELECT * FROM forms
WHERE status = 'pending'
ORDER BY last_accessed DESC;

-- Optional: Create a view for completed forms (awaiting lawyer review)
CREATE VIEW completed_forms AS
SELECT * FROM forms
WHERE status = 'completed' AND submitted_at IS NULL
ORDER BY marked_complete_at DESC;

-- Optional: Create a view for submitted forms
CREATE VIEW submitted_forms AS
SELECT * FROM forms
WHERE status = 'submitted' AND submitted_at IS NOT NULL
ORDER BY submitted_at DESC;
