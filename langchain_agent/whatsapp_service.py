"""
whatsapp_service.py — WhatsApp Cloud API sender.
Sends template messages via Meta Graph API.
"""

from __future__ import annotations

import json
import logging
from typing import Optional

import httpx

from langchain_agent.whatsapp_config import whatsapp_config

logger = logging.getLogger(__name__)


def send_whatsapp_template(
    recipient_phone: str,
    alert_message: str,
) -> bool:
    """
    Send WhatsApp template message via Meta Cloud API.

    Args:
        recipient_phone: Recipient phone in international format without +.
                        E.g., "923001234567"
        alert_message: Alert message text to send (max 1024 chars).

    Returns:
        True if sent successfully, False otherwise.
        Returns False if WhatsApp is not configured.
    """
    if not whatsapp_config.is_configured():
        logger.warning("[WhatsApp] skipped (WhatsApp not configured)")
        return False

    recipient_norm = (recipient_phone or "").strip()
    if not recipient_norm:
        logger.warning("[WhatsApp] skipped (no recipient phone)")
        return False

    try:
        # Build API endpoint
        url = f"{whatsapp_config.WHATSAPP_API_BASE_URL}/{whatsapp_config.WHATSAPP_PHONE_NUMBER_ID}/messages"

        # Build template payload
        payload = {
            "messaging_product": "whatsapp",
            "to": recipient_norm,
            "type": "template",
            "template": {
                "name": whatsapp_config.WHATSAPP_TEMPLATE_NAME,
                "language": {"code": whatsapp_config.WHATSAPP_TEMPLATE_LANGUAGE},
                "components": [
                    {
                        "type": "body",
                        "parameters": [
                            {"type": "text", "text": alert_message[:1024]}
                        ],
                    }
                ],
            },
        }

        # Send via Meta Graph API
        headers = {
            "Authorization": f"Bearer {whatsapp_config.WHATSAPP_ACCESS_TOKEN}",
            "Content-Type": "application/json",
        }

        response = httpx.post(url, json=payload, headers=headers, timeout=10.0)

        if response.status_code in (200, 201):
            logger.info(
                "[WhatsApp] sent to=%s message_len=%d",
                recipient_norm,
                len(alert_message),
            )
            return True
        else:
            error_detail = ""
            try:
                error_data = response.json()
                error_detail = error_data.get("error", {}).get("message", str(error_data))
            except Exception:
                error_detail = response.text[:200]

            logger.warning(
                "[WhatsApp] failed to=%s status=%d error=%s",
                recipient_norm,
                response.status_code,
                error_detail,
            )
            return False

    except Exception as exc:
        logger.exception(
            "[WhatsApp] exception to=%s error=%s",
            recipient_norm,
            str(exc),
        )
        return False
