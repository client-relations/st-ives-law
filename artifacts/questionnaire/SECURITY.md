FORM SECURITY - HOW FORMS STAY PRIVATE

HOW FORMS ARE PROTECTED

Two-Factor Access Control:

1. Unique Token
   - Each form gets a random, unguessable token
   - Token is unique to ONE form only
   - Can't guess or brute force it
   - Invalid tokens get rejected

2. Email Verification
   - Client must enter their email
   - System checks: Does email match the one we sent the link to?
   - Wrong email = Access Denied
   - Only intended recipient can access

WHAT HAPPENS IF SOMEONE HAS THE LINK?

Scenario                           Result
Has link, wrong email              ❌ Denied
Has link, correct email            ✅ Granted (intended)
No link at all                     ❌ Denied
Random email + random link         ❌ Denied

SUPABASE DATABASE PROTECTION

- Encryption in transit: HTTPS/TLS (data traveling over internet is encrypted)
- Row-Level Security: Each user can only see their own data
- Password hashing: Passwords stored encrypted, never plain text

SUMMARY

Forms are NOT public because:
✓ Unique token per form
✓ Email verification required
✓ Database encrypts all data
✓ Only intended recipient gets access

Risk Level: LOW
Even if someone has the link, they still need the correct email.
