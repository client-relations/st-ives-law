---
name: form_status_workflow
description: Form status should only change via explicit actions, not just from opening
metadata:
  type: feedback
---

## Opening a form should not change its workflow status

**Rule:** Opening/viewing a form from the dashboard should not change its Kanban status. Status changes only happen through explicit actions (qualify, reject, complete, deprioritize).

**Why:** Opening forms was overwriting statuses (In Progress → Opened), causing forms to move to wrong Kanban columns when lawyers just reviewed them. This broke the workflow.

**How to apply:** 
- When form first accessed: only change 'sent' → 'opened' (tracking first access)
- When form accessed again: preserve existing status (don't override)
- Status flows: sent → opened → in_progress (via auto-save when progress > 0) → completed
- Other statuses (overdue, deprioritized) preserved on access
- See App.tsx lines 362-393 for access tracking logic

Related: [[pending_intake_forms_filter]]
