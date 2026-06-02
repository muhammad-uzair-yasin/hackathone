# Task: Background Email Sending for BioRoute Notifications

**Status:** Ready to Implement  
**Trigger:** -s  
**Owner:** backend-engineer

---

## Goal

Send actual emails to `uzairyasin395@gmail.com` for all 4 notification types (hospital, driver, coordinator, owner) via background worker thread. Notifications are queued by `notify_tool` during agent execution; a separate background thread polls and sends emails asynchronously.

---

## Requirements

1. **Copy SMTP config** from postsiva-backend `.env` (Gmail app credentials)
2. **Add email_service.py** — SMTP helper (copy pattern from postsiva)
3. **Add email_worker.py** — Background thread that polls `notifications.json` and sends emails
4. **Modify notify_tool** — Mark notifications as `email_pending` (not "SENT")
5. **Modify server.py** — Start/stop background worker on app startup/shutdown
6. **Update .env** — Add SMTP config
7. **Test locally** — Verify emails arrive

---

## Flow

```
Agent Execution (Synchronous)
    ↓
notify_tool writes 4 records to notifications.json
    ├─ status: "email_pending"
    ├─ email_sent_at: null
    └─ email_error: null
    ↓
Agent completes, SSE stream ends
    ↓
Background Worker (Async Thread)
    [Runs continuously, polls every 5 seconds]
    ├─ Find all records with status = "email_pending"
    ├─ For each: call send_email() via SMTP
    ├─ On success: status = "SENT (actual)", email_sent_at = now
    ├─ On failure: status = "FAILED", email_error = "..."
    └─ Log delivery in email_delivery.log

[Mobile app SSE completes while emails send in background]
```

---

## Acceptance Criteria

- ✅ Email config loaded from `.env` (SMTP_HOST, SMTP_USER, SMTP_PASS, etc.)
- ✅ All 4 notifications queued as `email_pending` (not "SENT")
- ✅ Background worker thread starts on app startup
- ✅ Background worker polls every 5 seconds
- ✅ Emails sent via Gmail SMTP to `uzairyasin395@gmail.com`
- ✅ Delivery logged in `email_delivery.log` and `notifications.json`
- ✅ Agent execution NOT blocked by email sending
- ✅ No new external dependencies (use `smtplib` from stdlib)

---

## Files to Change

| File | Change |
|------|--------|
| `.env` | Add SMTP config from postsiva |
| `langchain_agent/email_config.py` | NEW — Settings for SMTP |
| `langchain_agent/email_service.py` | NEW — send_email() function |
| `langchain_agent/email_worker.py` | NEW — Background poller thread |
| `langchain_agent/tools.py` | MODIFY — notify_tool to queue "email_pending" |
| `langchain_agent/api/server.py` | MODIFY — Start/stop background worker |

---

## Implementation Notes

### email_config.py
- Load SMTP settings from `.env`
- Fields: SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS, SMTP_FROM_EMAIL, SMTP_FROM_NAME, SMTP_TIMEOUT
- Return False if SMTP not configured (fallback for dev without SMTP)

### email_service.py
- Copy postsiva's `send_email()` function (stdlib `smtplib`, no deps)
- Signature: `send_email(to_email, subject, html_body, text_body=None) -> bool`
- Auto-strip HTML tags for plain text version
- Log via logger (success/failure)

### email_worker.py
- Thread that polls `notifications.json` every 5 seconds
- Find records with `email_status == "pending"`
- Call `send_email()` for each
- Update record: `email_status`, `email_sent_at`, `email_error`
- Log to `langchain_agent/data/email_delivery.log`
- Graceful shutdown on signal

### tools.py (notify_tool)
- Change status from "SENT (simulated)" to "email_pending"
- Add fields:
  - `email_status: "pending"`
  - `email_sent_at: null`
  - `email_error: null`

### server.py
- On startup: Start background worker thread (daemon=False for graceful shutdown)
- On shutdown: Wait for pending emails, then stop

---

## Test Scenario

1. Backend running: `uv run uvicorn langchain_agent.api.server:app --reload`
2. Send test alert: POST `/api/analyze` or GET `/api/stream?input=...`
3. Verify agent completes (SSE stream ends ~60s)
4. Check `notifications.json` — all 4 records have `email_status: "pending"` initially
5. Wait 5 seconds for background worker
6. Check `notifications.json` again — `email_status: "SENT (actual)"`, `email_sent_at: timestamp`
7. Check Gmail inbox (`uzairyasin395@gmail.com`) — 4 emails received

---

## Success Criteria

- All 4 notification emails arrive in Gmail inbox
- `notifications.json` updated with delivery status
- Agent execution time NOT increased (emails sent in background)
- `email_delivery.log` contains delivery records
- No agent errors or blocking

