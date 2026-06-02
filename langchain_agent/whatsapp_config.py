"""
whatsapp_config.py — WhatsApp Cloud API configuration loader.
Reads WhatsApp credentials from environment variables (.env).
"""

import os
import logging

logger = logging.getLogger(__name__)


class WhatsAppConfig:
    """WhatsApp Cloud API configuration container."""

    def __init__(self):
        self.WHATSAPP_ACCESS_TOKEN: str = os.getenv("WHATSAPP_ACCESS_TOKEN", "").strip()
        self.WHATSAPP_PHONE_NUMBER_ID: str = os.getenv("WHATSAPP_PHONE_NUMBER_ID", "").strip()
        self.WHATSAPP_BUSINESS_NUMBER: str = os.getenv("WHATSAPP_BUSINESS_NUMBER", "").strip()
        self.WHATSAPP_WEBHOOK_VERIFY_TOKEN: str = os.getenv("WHATSAPP_WEBHOOK_VERIFY_TOKEN", "").strip()

        # API endpoint (constant)
        self.WHATSAPP_API_BASE_URL = "https://graph.facebook.com/v20.0"
        self.WHATSAPP_TEMPLATE_NAME = "shipemnet_alert"  # Note: Meta template has typo "shipemnet"
        self.WHATSAPP_TEMPLATE_LANGUAGE = "en"

        self._log_config()

    def _log_config(self) -> None:
        """Log configuration status (hide token)."""
        if not self.is_configured():
            logger.warning(
                "[WhatsAppConfig] WhatsApp not fully configured — WhatsApp sending disabled"
            )
            return

        logger.info(
            "[WhatsAppConfig] WhatsApp configured: phone_id=%s business_number=%s template=%s",
            self.WHATSAPP_PHONE_NUMBER_ID,
            self.WHATSAPP_BUSINESS_NUMBER,
            self.WHATSAPP_TEMPLATE_NAME,
        )

    def is_configured(self) -> bool:
        """Check if WhatsApp is fully configured."""
        return bool(
            self.WHATSAPP_ACCESS_TOKEN
            and self.WHATSAPP_PHONE_NUMBER_ID
            and self.WHATSAPP_BUSINESS_NUMBER
        )


# Global singleton
whatsapp_config = WhatsAppConfig()
