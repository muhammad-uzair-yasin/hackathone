# Test Messaging APIs Documentation

## Overview

Two REST endpoints for testing email and WhatsApp sending independently (not part of agent flow). Both endpoints are **non-blocking** — they queue messages to background workers and return immediately.

---

## Endpoints

### 1. POST /api/test/send-email

**Purpose:** Test email sending via SMTP (Gmail).

**Base URL:** `http://localhost:8000`

**Request:**
```bash
curl -X POST http://localhost:8000/api/test/send-email \
  -H "Content-Type: application/json" \
  -d '{"subject": "Subject Text", "message": "Message body"}'
```

**Request Body:**
```json
{
  "subject": "Test Subject",
  "message": "This is the email message body"
}
```

**Response (Immediate):**
```json
{
  "success": true,
  "message": "Email queued for delivery (check inbox in ~5 seconds)",
  "recipient": "uzairyasin395@gmail.com",
  "subject": "Test Subject",
  "id": "TEST-EMAIL-033726"
}
```

**Hardcoded Recipient:** `uzairyasin395@gmail.com`

**Delivery:** Email is queued immediately, sent by background worker within ~5 seconds.

**Status Tracking:** Check `langchain_agent/data/test_emails.json` to see:
- `email_status: "pending"` — Email waiting to be sent
- `email_status: "SENT (actual)"` — Email successfully sent
- `email_status: "FAILED"` — Email send failed (see `email_error`)

---

### 2. POST /api/test/send-whatsapp

**Purpose:** Test WhatsApp template message sending via Meta Cloud API.

**Base URL:** `http://localhost:8000`

**Request:**
```bash
curl -X POST http://localhost:8000/api/test/send-whatsapp \
  -H "Content-Type: application/json" \
  -d '{"message": "Test alert message"}'
```

**Request Body:**
```json
{
  "message": "This is the WhatsApp alert message"
}
```

**Response (Immediate):**
```json
{
  "success": true,
  "message": "WhatsApp message queued for delivery (check phone in ~5 seconds)",
  "recipient": "923236891550",
  "text": "This is the WhatsApp alert message",
  "id": "TEST-WA-033748"
}
```

**Hardcoded Recipient Phone:** `923236891550` (no `+` prefix, international format)

**Template Used:** `shipment_alert` (Meta WhatsApp Business template)

**Delivery:** Message is queued immediately, sent by background worker within ~5 seconds.

**Status Tracking:** Check `langchain_agent/data/test_whatsapp.json` to see:
- `whatsapp_status: "pending"` — Message waiting to be sent
- `whatsapp_status: "SENT (actual)"` — Message successfully sent
- `whatsapp_status: "FAILED"` — Message send failed (see `whatsapp_error`)

---

## How It Works

### Non-Blocking Flow

```
User sends request
    ↓
API endpoint queues message to JSON file
    ↓
Response returns immediately (HTTP 200)
    ↓
[User continues, no waiting]
    ↓
[Background worker polls every 5 seconds]
    ├─ Finds pending message
    ├─ Sends via SMTP / Meta API
    └─ Updates status in JSON file
```

### Background Workers

- **EmailWorker** — Polls `test_emails.json` + `notifications.json` every 5 seconds
- **WhatsAppWorker** — Polls `test_whatsapp.json` + `notifications.json` every 5 seconds

Both workers run in separate threads and do NOT block the main API.

---

## Status Tracking Files

### Email Queue: `langchain_agent/data/test_emails.json`

```json
{
  "test_emails": [
    {
      "id": "TEST-EMAIL-033726",
      "timestamp": "2026-06-02T03:37:26Z",
      "recipient": "uzairyasin395@gmail.com",
      "subject": "Test Subject",
      "message": "Test message",
      "email_status": "SENT (actual)",
      "email_sent_at": "2026-06-02T03:37:31Z",
      "email_error": null
    }
  ]
}
```

### WhatsApp Queue: `langchain_agent/data/test_whatsapp.json`

```json
{
  "test_whatsapp": [
    {
      "id": "TEST-WA-033748",
      "timestamp": "2026-06-02T03:37:48Z",
      "recipient_phone": "923236891550",
      "message": "Test alert",
      "whatsapp_status": "SENT (actual)",
      "whatsapp_sent_at": "2026-06-02T03:37:53Z",
      "whatsapp_error": null
    }
  ]
}
```

---

## Delivery Logs

### Email Delivery Log: `langchain_agent/data/email_delivery.log`

```json
{"timestamp": "2026-06-02T03:37:31Z", "notification_id": "TEST-EMAIL-033726", "recipient": "uzairyasin395@gmail.com", "subject": "Test Subject", "status": "SUCCESS"}
```

### WhatsApp Delivery Log: `langchain_agent/data/whatsapp_delivery.log`

```json
{"timestamp": "2026-06-02T03:37:53Z", "notification_id": "TEST-WA-033748", "recipient_phone": "923236891550", "subject": "...", "status": "SUCCESS"}
```

---

## Test Sequence

### Step 1: Start Backend
```bash
cd ~/Documents/hackathone
uv run uvicorn langchain_agent.api.server:app --port 8000
```

### Step 2: Send Test Email
```bash
curl -X POST http://localhost:8000/api/test/send-email \
  -H "Content-Type: application/json" \
  -d '{"subject": "My Test", "message": "Hello from BioRoute!"}'
```

**Expected Response:**
```json
{"success": true, "message": "Email queued...", "recipient": "uzairyasin395@gmail.com"}
```

### Step 3: Wait 5 seconds
```bash
sleep 5
```

### Step 4: Check Status
```bash
cat langchain_agent/data/test_emails.json
```

**Expected:** `"email_status": "SENT (actual)"` (or "FAILED" if SMTP issue)

### Step 5: Send Test WhatsApp
```bash
curl -X POST http://localhost:8000/api/test/send-whatsapp \
  -H "Content-Type: application/json" \
  -d '{"message": "Test WhatsApp alert!"}'
```

**Expected Response:**
```json
{"success": true, "message": "WhatsApp queued...", "recipient": "923236891550"}
```

### Step 6: Wait 5 seconds
```bash
sleep 5
```

### Step 7: Check Status
```bash
cat langchain_agent/data/test_whatsapp.json
```

**Expected:** `"whatsapp_status": "SENT (actual)"` (or "FAILED" if API issue)

---

## Troubleshooting

| Issue | Cause | Solution |
|-------|-------|----------|
| Email status: `FAILED` | SMTP credentials invalid | Check `.env` SMTP settings |
| WhatsApp status: `FAILED` | Access token expired or invalid | Check `.env` WhatsApp token |
| API returns `500` error | Background workers not started | Ensure backend started correctly |
| Messages not in queue file | File permissions issue | Check `langchain_agent/data/` permissions |
| Status not updating | Background worker not running | Check logs for worker startup messages |

