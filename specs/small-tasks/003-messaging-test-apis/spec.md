# Task: Test APIs for Email and WhatsApp Sending

**Status:** Ready to Implement  
**Trigger:** -s  
**Owner:** backend-engineer

---

## Goal

Create 2 test APIs to verify email and WhatsApp template message sending independently (not part of agent flow). Messages are sent in background, not blocking the request.

---

## Requirements

1. **POST /api/test/send-email** — Send test email to hardcoded recipient
   - Request: `{"subject": "...", "message": "..."}`
   - Response: `{"success": true/false, "message": "...", "recipient": "uzairyasin395@gmail.com"}`
   - Background: Email queued immediately, response returns without waiting
   - Delivery happens ~5 seconds later (background worker)

2. **POST /api/test/send-whatsapp** — Send test WhatsApp to hardcoded number
   - Request: `{"message": "..."}`
   - Response: `{"success": true/false, "message": "...", "recipient": "923236891550"}`
   - Background: Message queued immediately, response returns without waiting
   - Delivery happens ~5 seconds later (background worker)

---

## Hardcoded Recipients

- **Email:** `uzairyasin395@gmail.com`
- **WhatsApp Phone:** `923236891550` (no + prefix)

---

## Implementation

### Endpoint 1: POST /api/test/send-email

**Path:** `langchain_agent/api/server.py`

```python
@app.post("/api/test/send-email")
async def test_send_email(request: dict):
    """
    Test email sending endpoint.
    Queues email to background worker (non-blocking).
    
    Request JSON:
    {
        "subject": "Test Subject",
        "message": "Test message body"
    }
    """
    subject = request.get("subject", "BioRoute Test Email")
    message = request.get("message", "Test message from BioRoute")
    recipient_email = "uzairyasin395@gmail.com"
    
    # Queue email via background worker (create a test queue)
    # → Add to a test_emails.json file or queue in notifications.json
    # Response returns immediately (non-blocking)
    
    return {
        "success": True,
        "message": f"Email queued for delivery (check inbox in ~5 seconds)",
        "recipient": recipient_email,
        "subject": subject,
    }
```

### Endpoint 2: POST /api/test/send-whatsapp

**Path:** `langchain_agent/api/server.py`

```python
@app.post("/api/test/send-whatsapp")
async def test_send_whatsapp(request: dict):
    """
    Test WhatsApp sending endpoint.
    Queues WhatsApp template message to background worker (non-blocking).
    
    Request JSON:
    {
        "message": "Test alert message"
    }
    """
    message = request.get("message", "Test alert from BioRoute")
    recipient_phone = "923236891550"
    
    # Queue WhatsApp via background worker (create a test queue)
    # → Add to a test_whatsapp.json file or queue in notifications.json
    # Response returns immediately (non-blocking)
    
    return {
        "success": True,
        "message": f"WhatsApp message queued for delivery (check phone in ~5 seconds)",
        "recipient": recipient_phone,
        "text": message,
    }
```

---

## Data Storage

Create two separate JSON files for test messages (similar to notifications.json):

- `langchain_agent/data/test_emails.json` — Queue for test emails
- `langchain_agent/data/test_whatsapp.json` — Queue for test WhatsApp messages

**Format:**
```json
{
  "test_emails": [
    {
      "id": "TEST-EMAIL-001",
      "timestamp": "2026-06-02T...",
      "recipient": "uzairyasin395@gmail.com",
      "subject": "...",
      "message": "...",
      "email_status": "pending",
      "email_sent_at": null,
      "email_error": null
    }
  ]
}
```

```json
{
  "test_whatsapp": [
    {
      "id": "TEST-WA-001",
      "timestamp": "2026-06-02T...",
      "recipient_phone": "923236891550",
      "message": "...",
      "whatsapp_status": "pending",
      "whatsapp_sent_at": null,
      "whatsapp_error": null
    }
  ]
}
```

---

## Background Worker Updates

Modify `email_worker.py` and `whatsapp_worker.py` to also poll test queues:

- `email_worker` → Poll both `notifications.json` AND `test_emails.json`
- `whatsapp_worker` → Poll both `notifications.json` AND `test_whatsapp.json`

---

## Test Scenario

**Test Email:**
```bash
curl -X POST http://localhost:8000/api/test/send-email \
  -H "Content-Type: application/json" \
  -d '{"subject": "BioRoute Test", "message": "Hello from BioRoute!"}'

# Response (immediate, non-blocking):
# {"success": true, "message": "Email queued...", "recipient": "uzairyasin395@gmail.com"}

# Wait 5 seconds, check Gmail inbox → Email should arrive
```

**Test WhatsApp:**
```bash
curl -X POST http://localhost:8000/api/test/send-whatsapp \
  -H "Content-Type: application/json" \
  -d '{"message": "Test WhatsApp from BioRoute"}'

# Response (immediate, non-blocking):
# {"success": true, "message": "WhatsApp queued...", "recipient": "923236891550"}

# Wait 5 seconds, check WhatsApp → Message should arrive
```

---

## Success Criteria

- ✅ `/api/test/send-email` endpoint works (request returns immediately)
- ✅ `/api/test/send-whatsapp` endpoint works (request returns immediately)
- ✅ Email queued in `test_emails.json` with `email_status: "pending"`
- ✅ WhatsApp queued in `test_whatsapp.json` with `whatsapp_status: "pending"`
- ✅ Background workers poll and send within 5 seconds
- ✅ Status updated to "SENT (actual)" after delivery
- ✅ No blocking in request/response cycle

