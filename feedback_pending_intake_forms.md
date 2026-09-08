---
name: pending_intake_forms_filter
description: Pending intake forms should include all incomplete forms regardless of status
metadata:
  type: feedback
---

## Pending intake forms should show ALL incomplete forms

**Rule:** "Pending Intake Forms" in Overview should include any form that hasn't reached completion/submission yet, not just specific statuses.

**Why:** Forms disappeared from overview when opened because filter only checked 'sent' status. User needs visibility of all active/in-progress work.

**How to apply:** 
In DashboardV2.tsx line 789:
```javascript
const overviewIntakeForms = realForms.filter(f => !['completed', 'submitted'].includes(f.status));
```

This includes: sent, opened, in_progress, overdue, deprioritized
Excludes: completed, submitted

Commit: e7e870d "Show all incomplete forms in pending intake forms"

Related: [[form_status_workflow]]
