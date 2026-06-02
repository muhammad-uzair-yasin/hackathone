"""
email_worker.py — Background email delivery worker.
Polls notifications.json for pending emails and sends them asynchronously.
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

from langchain_agent.email_service import send_email

logger = logging.getLogger(__name__)

DATA_DIR = Path(__file__).parent / "data"
NOTIFICATIONS_FILE = DATA_DIR / "notifications.json"
TEST_EMAILS_FILE = DATA_DIR / "test_emails.json"
EMAIL_DELIVERY_LOG = DATA_DIR / "email_delivery.log"


class BackgroundEmailWorker:
    """
    Background thread that polls notifications.json and sends pending emails.
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
        logger.info("[EmailWorker] Initialized (poll_interval=%ds)", poll_interval)

    def start(self) -> None:
        """Start the background worker thread."""
        if self.running:
            logger.warning("[EmailWorker] Already running")
            return

        self.running = True
        self.thread = threading.Thread(target=self._run, daemon=False)
        self.thread.start()
        logger.info("[EmailWorker] Started in background thread")

    def stop(self) -> None:
        """Stop the background worker gracefully."""
        if not self.running:
            logger.warning("[EmailWorker] Not running")
            return

        logger.info("[EmailWorker] Stopping...")
        self.running = False

        # Wait for thread to finish (up to 10 seconds)
        if self.thread:
            self.thread.join(timeout=10.0)
            logger.info("[EmailWorker] Stopped")

    def _run(self) -> None:
        """Main polling loop (runs in background thread)."""
        logger.info("[EmailWorker] Polling loop started")

        while self.running:
            try:
                self._poll_and_send()
            except Exception as exc:
                logger.exception("[EmailWorker] Unexpected error in poll loop: %s", exc)

            # Sleep before next poll
            time.sleep(self.poll_interval)

        logger.info("[EmailWorker] Polling loop ended")

    def _poll_and_send(self) -> None:
        """Poll notifications.json and test_emails.json for pending emails."""
        files_to_poll = [
            (NOTIFICATIONS_FILE, "notifications"),
            (TEST_EMAILS_FILE, "test_emails"),
        ]
        
        for file_path, key in files_to_poll:
            if not file_path.exists():
                continue
            
            try:
                with open(file_path, "r") as f:
                    data = json.load(f)
            except (json.JSONDecodeError, OSError) as exc:
                logger.warning("[EmailWorker] Failed to read %s: %s", file_path.name, exc)
                continue

            records = data.get(key, [])
            if not records:
                continue

            # Find pending emails
            pending = [
                (i, r)
                for i, r in enumerate(records)
                if r.get("email_status") == "pending"
            ]

            if not pending:
                continue

            logger.debug("[EmailWorker] Found %d pending emails in %s", len(pending), file_path.name)

            # Send each pending email
            for idx, record in pending:
                self._send_notification_email(records, idx, record)

            # Write updated records back to file
            try:
                with open(file_path, "w") as f:
                    json.dump(data, f, indent=2)
            except OSError as exc:
                logger.exception("[EmailWorker] Failed to write %s: %s", file_path.name, exc)

    def _send_notification_email(
        self, notifications: list, idx: int, notification: dict
    ) -> None:
        """Send one notification email and update status."""
        recipient_email = notification.get("recipient_email") or "uzairyasin395@gmail.com"
        subject = notification.get("subject") or "BioRoute Alert"
        html_body = notification.get("message") or ""

        # Plain text fallback
        text_body = notification.get("text_body") or None

        timestamp_now = datetime.now(timezone.utc).isoformat()

        # Send email
        success = send_email(recipient_email, subject, html_body, text_body)

        # Update notification record
        if success:
            notifications[idx]["email_status"] = "SENT (actual)"
            notifications[idx]["email_sent_at"] = timestamp_now
            notifications[idx]["email_error"] = None
            self._log_delivery(notification, "SUCCESS", recipient_email, timestamp_now)
            logger.info(
                "[EmailWorker] Email sent: %s to %s",
                notification.get("notification_id", "?"),
                recipient_email,
            )
        else:
            notifications[idx]["email_status"] = "FAILED"
            notifications[idx]["email_error"] = "SMTP send failed (see logs for details)"
            self._log_delivery(notification, "FAILED", recipient_email, timestamp_now)
            logger.warning(
                "[EmailWorker] Email failed: %s to %s",
                notification.get("notification_id", "?"),
                recipient_email,
            )

    def _log_delivery(
        self, notification: dict, status: str, recipient: str, timestamp: str
    ) -> None:
        """Log email delivery attempt to email_delivery.log."""
        try:
            record = {
                "timestamp": timestamp,
                "notification_id": notification.get("notification_id", "?"),
                "recipient": recipient,
                "subject": (notification.get("subject") or "")[:100],
                "status": status,
            }
            log_line = json.dumps(record) + "\n"
            with open(EMAIL_DELIVERY_LOG, "a") as f:
                f.write(log_line)
        except OSError as exc:
            logger.warning("[EmailWorker] Failed to log delivery: %s", exc)
