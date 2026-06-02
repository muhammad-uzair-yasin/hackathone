"""
whatsapp_worker.py — Background WhatsApp delivery worker.
Polls notifications.json for pending WhatsApp messages and sends them asynchronously.
Runs in a separate thread — does not block agent execution.
"""

from __future__ import annotations

import json
import logging
import threading
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from langchain_agent.whatsapp_service import send_whatsapp_template

logger = logging.getLogger(__name__)

DATA_DIR = Path(__file__).parent / "data"
NOTIFICATIONS_FILE = DATA_DIR / "notifications.json"
TEST_WHATSAPP_FILE = DATA_DIR / "test_whatsapp.json"
WHATSAPP_DELIVERY_LOG = DATA_DIR / "whatsapp_delivery.log"


class BackgroundWhatsAppWorker:
    """
    Background thread that polls notifications.json and sends pending WhatsApp messages.
    Does not block agent execution. Graceful startup/shutdown.
    """

    def __init__(self, poll_interval: int = 5):
        """
        Initialize the worker.

        Args:
            poll_interval: Seconds between polling attempts (default 5).
        """
        self.poll_interval = poll_interval
        self.running = False
        self.thread: Optional[threading.Thread] = None
        logger.info("[WhatsAppWorker] Initialized (poll_interval=%ds)", poll_interval)

    def start(self) -> None:
        """Start the background worker thread."""
        if self.running:
            logger.warning("[WhatsAppWorker] Already running")
            return

        self.running = True
        self.thread = threading.Thread(target=self._run, daemon=False)
        self.thread.start()
        logger.info("[WhatsAppWorker] Started in background thread")

    def stop(self) -> None:
        """Stop the background worker gracefully."""
        if not self.running:
            logger.warning("[WhatsAppWorker] Not running")
            return

        logger.info("[WhatsAppWorker] Stopping...")
        self.running = False

        # Wait for thread to finish (up to 10 seconds)
        if self.thread:
            self.thread.join(timeout=10.0)
            logger.info("[WhatsAppWorker] Stopped")

    def _run(self) -> None:
        """Main polling loop (runs in background thread)."""
        logger.info("[WhatsAppWorker] Polling loop started")

        while self.running:
            try:
                self._poll_and_send()
            except Exception as exc:
                logger.exception("[WhatsAppWorker] Unexpected error in poll loop: %s", exc)

            # Sleep before next poll
            time.sleep(self.poll_interval)

        logger.info("[WhatsAppWorker] Polling loop ended")

    def _poll_and_send(self) -> None:
        """Poll notifications.json and test_whatsapp.json for pending messages."""
        files_to_poll = [
            (NOTIFICATIONS_FILE, "notifications"),
            (TEST_WHATSAPP_FILE, "test_whatsapp"),
        ]
        
        for file_path, key in files_to_poll:
            if not file_path.exists():
                continue
            
            try:
                with open(file_path, "r") as f:
                    data = json.load(f)
            except (json.JSONDecodeError, OSError) as exc:
                logger.warning("[WhatsAppWorker] Failed to read %s: %s", file_path.name, exc)
                continue

            records = data.get(key, [])
            if not records:
                continue

            # Find pending WhatsApp messages
            pending = [
                (i, r)
                for i, r in enumerate(records)
                if r.get("whatsapp_status") == "pending"
            ]

            if not pending:
                continue

            logger.debug("[WhatsAppWorker] Found %d pending messages in %s", len(pending), file_path.name)

            # Send each pending message
            for idx, record in pending:
                self._send_notification_whatsapp(records, idx, record)

            # Write updated records back to file
            try:
                with open(file_path, "w") as f:
                    json.dump(data, f, indent=2)
            except OSError as exc:
                logger.exception("[WhatsAppWorker] Failed to write %s: %s", file_path.name, exc)

    def _send_notification_whatsapp(
        self, notifications: list, idx: int, notification: dict
    ) -> None:
        """Send one notification via WhatsApp and update status."""
        recipient_phone = notification.get("recipient_phone") or ""
        subject = notification.get("subject") or ""
        message_text = notification.get("message") or ""

        # Format alert message for WhatsApp (subject + message)
        alert_message = f"{subject}\n\n{message_text}".strip()
        if not alert_message:
            alert_message = "BioRoute Alert"

        timestamp_now = datetime.now(timezone.utc).isoformat()

        # Send WhatsApp message
        success = send_whatsapp_template(recipient_phone, alert_message)

        # Update notification record
        if success:
            notifications[idx]["whatsapp_status"] = "SENT (actual)"
            notifications[idx]["whatsapp_sent_at"] = timestamp_now
            notifications[idx]["whatsapp_error"] = None
            self._log_delivery(notification, "SUCCESS", recipient_phone, timestamp_now)
            logger.info(
                "[WhatsAppWorker] WhatsApp sent: %s to %s",
                notification.get("notification_id", "?"),
                recipient_phone,
            )
        else:
            notifications[idx]["whatsapp_status"] = "FAILED"
            notifications[idx]["whatsapp_error"] = "WhatsApp API send failed (see logs)"
            self._log_delivery(notification, "FAILED", recipient_phone, timestamp_now)
            logger.warning(
                "[WhatsAppWorker] WhatsApp failed: %s to %s",
                notification.get("notification_id", "?"),
                recipient_phone,
            )

    def _log_delivery(
        self, notification: dict, status: str, recipient: str, timestamp: str
    ) -> None:
        """Log WhatsApp delivery attempt to whatsapp_delivery.log."""
        try:
            record = {
                "timestamp": timestamp,
                "notification_id": notification.get("notification_id", "?"),
                "recipient_phone": recipient,
                "subject": (notification.get("subject") or "")[:100],
                "status": status,
            }
            log_line = json.dumps(record) + "\n"
            with open(WHATSAPP_DELIVERY_LOG, "a") as f:
                f.write(log_line)
        except OSError as exc:
            logger.warning("[WhatsAppWorker] Failed to log delivery: %s", exc)
