# Row-Level Security (RLS) Policies for Nautilus Law Dashboard

These RLS policies should be applied to Supabase to enforce access control.

## Setup

1. Enable RLS on all tables:
   - lawyers
   - screening_submissions
   - forms

2. Apply the following policies:

## Policy: lawyers (Read Own Profile)

```sql
CREATE POLICY "Users can read their own lawyer profile"
  ON lawyers
  FOR SELECT
  USING (auth.uid()::text = id OR EXISTS (
    SELECT 1 FROM lawyers WHERE id = auth.uid()::text AND is_admin = true
  ));
```

## Policy: screening_submissions (Read Own + Admin)

```sql
CREATE POLICY "Lawyers can read own screening submissions"
  ON screening_submissions
  FOR SELECT
  USING (
    lawyer_id::text = (SELECT id FROM lawyers WHERE email = auth.jwt()->>'email' LIMIT 1)
    OR EXISTS (
      SELECT 1 FROM lawyers 
      WHERE email = auth.jwt()->>'email' AND is_admin = true
    )
  );

CREATE POLICY "Lawyers can insert their own screening submissions"
  ON screening_submissions
  FOR INSERT
  WITH CHECK (
    lawyer_id::text = (SELECT id FROM lawyers WHERE email = auth.jwt()->>'email' LIMIT 1)
  );

CREATE POLICY "Lawyers can update own screening submissions"
  ON screening_submissions
  FOR UPDATE
  USING (
    lawyer_id::text = (SELECT id FROM lawyers WHERE email = auth.jwt()->>'email' LIMIT 1)
    OR EXISTS (
      SELECT 1 FROM lawyers 
      WHERE email = auth.jwt()->>'email' AND is_admin = true
    )
  )
  WITH CHECK (
    lawyer_id::text = (SELECT id FROM lawyers WHERE email = auth.jwt()->>'email' LIMIT 1)
    OR EXISTS (
      SELECT 1 FROM lawyers 
      WHERE email = auth.jwt()->>'email' AND is_admin = true
    )
  );
```

## Policy: forms (Read Own + Admin)

```sql
CREATE POLICY "Lawyers can read own forms"
  ON forms
  FOR SELECT
  USING (
    lawyer_id::text = (SELECT id FROM lawyers WHERE email = auth.jwt()->>'email' LIMIT 1)
    OR EXISTS (
      SELECT 1 FROM lawyers 
      WHERE email = auth.jwt()->>'email' AND is_admin = true
    )
  );

CREATE POLICY "Lawyers can insert their own forms"
  ON forms
  FOR INSERT
  WITH CHECK (
    lawyer_id::text = (SELECT id FROM lawyers WHERE email = auth.jwt()->>'email' LIMIT 1)
  );

CREATE POLICY "Lawyers can update own forms"
  ON forms
  FOR UPDATE
  USING (
    lawyer_id::text = (SELECT id FROM lawyers WHERE email = auth.jwt()->>'email' LIMIT 1)
    OR EXISTS (
      SELECT 1 FROM lawyers 
      WHERE email = auth.jwt()->>'email' AND is_admin = true
    )
  )
  WITH CHECK (
    lawyer_id::text = (SELECT id FROM lawyers WHERE email = auth.jwt()->>'email' LIMIT 1)
    OR EXISTS (
      SELECT 1 FROM lawyers 
      WHERE email = auth.jwt()->>'email' AND is_admin = true
    )
  );
```

## Notes

- Admins can read/update all screening submissions and forms
- Regular lawyers can only see and modify their own data
- External form submissions (via unique_screening_token) should not require authentication
- Consider adding time-based token expiration for security

## Implementation Status

- [ ] Enable RLS on all tables
- [ ] Apply all policies above
- [ ] Test access restrictions
- [ ] Verify admin override works
