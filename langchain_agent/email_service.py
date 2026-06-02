"""
email_service.py — SMTP email sender.
Adapted from postsiva-backend email_service.py.
Uses stdlib smtplib — no external dependencies.
"""

from __future__ import annotations

import re
import smtplib
import logging
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Optional

from langchain_agent.email_config import email_config

logger = logging.getLogger(__name__)


def send_email(
    to_email: str,
    subject: str,
    html_body: str,
    text_body: Optional[str] = None,
) -> bool:
    """
    Send email via SMTP.

    Args:
        to_email: Recipient email address.
        subject: Email subject line.
        html_body: HTML email body.
        text_body: Plain text version (auto-generated from HTML if not provided).

    Returns:
        True if sent successfully, False otherwise.
        Returns False if SMTP is not configured.
    """
    to_norm = (to_email or "").strip() or "(missing-recipient)"

    if not email_config.is_configured():
        logger.warning("[EMAIL] skipped (SMTP not configured) to=%s", to_norm)
        return False

    try:
        smtp_host = email_config.SMTP_HOST
        smtp_port = email_config.SMTP_PORT
        smtp_user = email_config.SMTP_USER
        smtp_password = email_config.SMTP_PASS
        smtp_from_email = email_config.SMTP_FROM_EMAIL
        smtp_from_name = email_config.SMTP_FROM_NAME
        timeout = email_config.SMTP_TIMEOUT

        # Create message
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = f"{smtp_from_name} <{smtp_from_email}>"
        msg["To"] = to_email

        # Generate plain text from HTML if not provided
        if not text_body:
            text_body = re.sub(r"<[^>]+>", "", html_body)
            text_body = (
                text_body.replace("&nbsp;", " ")
                .replace("&amp;", "&")
                .replace("&lt;", "<")
                .replace("&gt;", ">")
            )

        msg.attach(MIMEText(text_body, "plain"))
        msg.attach(MIMEText(html_body, "html"))

        # Send via SMTP
        if email_config.SMTP_SECURE:
            with smtplib.SMTP_SSL(smtp_host, smtp_port, timeout=timeout) as server:
                server.login(smtp_user, smtp_password)
                server.send_message(msg)
        else:
            with smtplib.SMTP(smtp_host, smtp_port, timeout=timeout) as server:
                server.starttls()
                server.login(smtp_user, smtp_password)
                server.send_message(msg)

        logger.info(
            "[EMAIL] sent to=%s subject=%s",
            to_norm,
            (subject or "")[:80],
        )
        return True

    except Exception as exc:
        logger.exception("[EMAIL] failed to=%s error=%s", to_norm, str(exc))
        return False
