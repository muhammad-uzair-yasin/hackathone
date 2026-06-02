# Task Breakdown — Background Email Sending

**Spec:** specs/small-tasks/001-email-background/spec.md

---

## Tasks

### [x] Task 1 — Add SMTP config to .env
**Priority:** P0  
**Owner:** backend-engineer

- [ ] Copy SMTP config from postsiva-backend `.env`
- [ ] Add to root `.env`:
  ```
  SMTP_HOST=smtp.gmail.com
  SMTP_PORT=587
  SMTP_SECURE=false
  SMTP_USER=postsiva.support@gmail.com
  SMTP_PASS=hhsk zdmr tlqn xmux
  SMTP_FROM_EMAIL=postsiva.support@gmail.com
  SMTP_FROM_NAME=Postsiva Support
  SMTP_TIMEOUT=60
  ```

---

### [x] Task 2 — Create email_config.py
**Priority:** P0  
**Owner:** backend-engineer

- [ ] Create `langchain_agent/email_config.py`
- [ ] Load SMTP settings from `.env` using `os.getenv()`
- [ ] Return settings object or dict with fields:
  - `SMTP_HOST`
  - `SMTP_PORT` (int)
  - `SMTP_SECURE` (bool)
  - `SMTP_USER`
  - `SMTP_PASS`
  - `SMTP_FROM_EMAIL`
  - `SMTP_FROM_NAME`
  - `SMTP_TIMEOUT` (int)
- [ ] Log warning if SMTP not configured

---

### [x] Task 3 — Create email_service.py
**Priority:** P0  
**Owner:** backend-engineer

- [ ] Create `langchain_agent/email_service.py`
- [ ] Copy `send_email()` function from postsiva-backend/app/utils/email_service.py
- [ ] Adapt to BioRoute (remove UUID tracking, simplify logging)
- [ ] Function signature:
  ```python
  def send_email(to_email: str, subject: str, html_body: str, 
                 text_body: Optional[str] = None) -> bool
  ```
- [ ] Return True on success, False on failure
- [ ] Log via logger (info for success, exception for errors)
- [ ] No external dependencies (use `smtplib`, `email.mime`)

---

### [x] Task 4 — Create email_worker.py
**Priority:** P0  
**Owner:** backend-engineer

- [ ] Create `langchain_agent/email_worker.py`
- [ ] Implement `BackgroundEmailWorker` class:
  - `__init__()`: read email_config, set up logger
  - `start()`: spawn daemon thread, run polling loop
  - `stop()`: graceful shutdown, wait for pending emails
  - `poll()`: read notifications.json, find `email_pending`, send emails
  - `_send_notification_email()`: extract recipient + body, call email_service.send_email()
  - `_update_notification()`: write status + timestamp + error to notifications.json
- [ ] Poll interval: 5 seconds
- [ ] Log all deliveries to `email_delivery.log`
- [ ] Handle JSON read/write errors gracefully (continue polling)

---

### [x] Task 5 — Modify notify_tool in tools.py
**Priority:** P0  
**Owner:** backend-engineer

- [ ] Modify `notify_tool()` function
- [ ] Change notification records:
  - Old: `status: "SENT (simulated)"`
  - New: `email_status: "pending"`
- [ ] Add fields to each record:
  - `email_status: "pending"`
  - `email_sent_at: null`
  - `email_error: null`
  - `recipient_email: "uzairyasin395@gmail.com"` (override for now)
- [ ] All 4 notification types (hospital, driver, coordinator, owner) go to same email

---

### [x] Task 6 — Modify server.py
**Priority:** P0  
**Owner:** backend-engineer

- [ ] Add import: `from langchain_agent.email_worker import BackgroundEmailWorker`
- [ ] Create global instance: `email_worker = None`
- [ ] On app startup (FastAPI `lifespan` or `@app.on_event("startup")`):
  - Initialize `email_worker = BackgroundEmailWorker()`
  - Call `email_worker.start()`
  - Log: "Background email worker started"
- [ ] On app shutdown (FastAPI `lifespan` or `@app.on_event("shutdown")`):
  - Call `email_worker.stop()` (if not None)
  - Log: "Background email worker stopped"

---

### [x] Task 7 — Test email sending locally
**Priority:** P1  
**Owner:** backend-engineer

- [ ] Start backend: `uv run uvicorn langchain_agent.api.server:app --reload`
- [ ] Verify background worker started (check logs)
- [ ] Send test alert: `curl -N "http://localhost:8000/api/stream?input=Heatwave%20in%20District%204"`
- [ ] Wait for agent to complete (~60s)
- [ ] Check `notifications.json` — all 4 records have `email_status: "pending"`
- [ ] Wait 5 seconds
- [ ] Check `notifications.json` again — `email_status: "SENT (actual)"`, `email_sent_at: timestamp`
- [ ] Check `email_delivery.log` — 4 delivery records
- [ ] Check Gmail inbox (`uzairyasin395@gmail.com`) — 4 emails received
- [ ] Verify email subjects and bodies match

---

## Implementation Order

1. Task 1 — Add .env config
2. Task 2 — email_config.py
3. Task 3 — email_service.py
4. Task 4 — email_worker.py (most complex)
5. Task 5 — Modify tools.py
6. Task 6 — Modify server.py
7. Task 7 — Test locally

---

## Estimated Time

- Tasks 1–3: 15 min
- Task 4: 30 min
- Tasks 5–6: 10 min
- Task 7: 15 min
- **Total: ~70 min**

