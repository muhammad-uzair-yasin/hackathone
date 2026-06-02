# Task: Background WhatsApp Template Messaging for BioRoute Notifications

**Status:** Ready to Implement  
**Trigger:** -s  
**Owner:** backend-engineer

---

## Goal

Send WhatsApp messages using Meta's `shipment_alert` template to recipients via background worker thread. Messages are queued by `notify_tool` during agent execution; a separate background thread polls and sends WhatsApp messages asynchronously.

---

## Requirements

1. **Copy WhatsApp config** from postsiva-backend `.env`
2. **Add whatsapp_config.py** — WhatsApp API configuration loader
3. **Add whatsapp_service.py** — Meta Graph API caller for template messages
4. **Add whatsapp_worker.py** — Background thread that polls `notifications.json` and sends WhatsApp
5. **Modify notify_tool** — Mark notifications as `whatsapp_status: "pending"` + add phone numbers
6. **Modify server.py** — Start/stop background WhatsApp worker on app startup/shutdown
7. **Update .env** — Add WhatsApp config
8. **Test locally** — Verify WhatsApp messages are queued and sent

---

## WhatsApp Template Details

**Template Name:** `shipment_alert`  
**Language:** `en` (English)  
**Provider:** Meta WhatsApp Cloud API  
**API Endpoint:** `https://graph.facebook.com/v20.0/{PHONE_NUMBER_ID}/messages`

**Payload Structure:**
```json
{
  "messaging_product": "whatsapp",
  "to": "{{recipient_number}}",
  "type": "template",
  "template": {
    "name": "shipment_alert",
    "language": { "code": "en" },
    "components": [
      {
        "type": "body",
        "parameters": [
          { "type": "text", "text": "{{alert_message}}" }
        ]
      }
    ]
  }
}
```

**Parameters:**
- `recipient_number` — International format, no `+`. E.g., `923001234567`
- `alert_message` — The alert text to send (max 1024 chars, plain text)

---

## Flow

```
Agent Execution (Synchronous)
    ↓
notify_tool writes 4 records to notifications.json
    ├─ whatsapp_status: "pending"
    ├─ recipient_phone: "923157349862" (from WHATSAPP_BUSINESS_NUMBER)
    ├─ whatsapp_sent_at: null
    └─ whatsapp_error: null
    ↓
Agent completes, SSE stream ends
    ↓
Background WhatsAppWorker (Async Thread)
    [Runs continuously, polls every 5 seconds]
    ├─ Find all records with whatsapp_status = "pending"
    ├─ For each: call Meta Graph API with template payload
    ├─ On success: whatsapp_status = "SENT (actual)", whatsapp_sent_at = now
    ├─ On failure: whatsapp_status = "FAILED", whatsapp_error = "..."
    └─ Log delivery in whatsapp_delivery.log
```

---

## Acceptance Criteria

- ✅ WhatsApp config loaded from `.env` (WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_BUSINESS_NUMBER)
- ✅ All 4 notifications queued as `whatsapp_status: "pending"` with recipient phone
- ✅ Background worker thread starts on app startup
- ✅ Background worker polls every 5 seconds
- ✅ WhatsApp messages sent via Meta Graph API (template: `shipment_alert`)
- ✅ Delivery logged in `whatsapp_delivery.log` and `notifications.json`
- ✅ Agent execution NOT blocked by WhatsApp sending
- ✅ No new external dependencies (use `httpx` async client, already available)

---

## Files to Change

| File | Change |
|------|--------|
| `.env` | Add WhatsApp config from postsiva |
| `langchain_agent/whatsapp_config.py` | NEW — WhatsApp API config loader |
| `langchain_agent/whatsapp_service.py` | NEW — Meta Graph API client |
| `langchain_agent/whatsapp_worker.py` | NEW — Background polling thread |
| `langchain_agent/tools.py` | MODIFY — notify_tool to queue WhatsApp |
| `langchain_agent/api/server.py` | MODIFY — Start/stop WhatsApp worker |

---

## Implementation Notes

### whatsapp_config.py
- Load from `.env`: WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_BUSINESS_NUMBER
- Return False if WhatsApp not configured (fallback for dev)

### whatsapp_service.py
- Function: `send_whatsapp_template(recipient_phone, alert_message) -> bool`
- Call `https://graph.facebook.com/v20.0/{PHONE_NUMBER_ID}/messages` (POST)
- Use `httpx.post()` (async-compatible, already in dependencies)
- Log via logger (success/failure)
- Handle API errors gracefully

### whatsapp_worker.py
- Thread that polls `notifications.json` every 5 seconds
- Find records with `whatsapp_status == "pending"`
- Call `send_whatsapp_template()` for each
- Update record: `whatsapp_status`, `whatsapp_sent_at`, `whatsapp_error`
- Log to `langchain_agent/data/whatsapp_delivery.log`

### tools.py (notify_tool)
- Add fields to each notification record:
  - `whatsapp_status: "pending"`
  - `recipient_phone: "923157349862"` (from config)
  - `whatsapp_sent_at: null`
  - `whatsapp_error: null`

### server.py
- On startup: Start WhatsAppWorker thread
- On shutdown: Stop gracefully

---

## Test Scenario

1. Backend running: `uv run uvicorn langchain_agent.api.server:app --reload`
2. Send test alert: `curl -N "http://localhost:8000/api/stream?input=Heatwave%20in%20District%204"`
3. Wait for agent to complete (~60s)
4. Check `notifications.json` — all 4 records have `whatsapp_status: "pending"`
5. Wait 5 seconds for background worker
6. Check `notifications.json` again — `whatsapp_status: "SENT (actual)"`, `whatsapp_sent_at: timestamp`
7. Check `whatsapp_delivery.log` — 4 delivery records
8. Verify WhatsApp messages received on WHATSAPP_BUSINESS_NUMBER phone

---

## Success Criteria

- All 4 WhatsApp messages queued and sent
- `notifications.json` updated with delivery status
- Agent execution time NOT increased (WhatsApp sent in background)
- `whatsapp_delivery.log` contains delivery records
- No agent errors or blocking

