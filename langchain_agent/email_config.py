"""
email_config.py — SMTP configuration loader.
Reads SMTP settings from environment variables (.env).
"""

import os
from typing import Optional

import logging

logger = logging.getLogger(__name__)


class EmailConfig:
    """SMTP configuration container."""

    def __init__(self):
        self.SMTP_HOST: str = os.getenv("SMTP_HOST", "").strip()
        self.SMTP_PORT: int = int(os.getenv("SMTP_PORT", "587"))
        self.SMTP_SECURE: bool = self._parse_bool(os.getenv("SMTP_SECURE", "false"))
        self.SMTP_USER: str = os.getenv("SMTP_USER", "").strip()
        self.SMTP_PASS: str = os.getenv("SMTP_PASS", "").strip()
        self.SMTP_FROM_EMAIL: str = os.getenv("SMTP_FROM_EMAIL", "").strip()
        self.SMTP_FROM_NAME: str = os.getenv("SMTP_FROM_NAME", "BioRoute").strip()
        self.SMTP_TIMEOUT: int = int(os.getenv("SMTP_TIMEOUT", "60"))

        self._log_config()

    def _parse_bool(self, value: str) -> bool:
        """Parse string to boolean."""
        return str(value or "false").strip().lower() in ("1", "true", "yes", "on")

    def _log_config(self) -> None:
        """Log configuration status (hide password)."""
        if not self.is_configured():
            logger.warning(
                "[EmailConfig] SMTP not fully configured — email sending disabled"
            )
            return

        logger.info(
            "[EmailConfig] SMTP configured: host=%s port=%d user=%s from=%s",
            self.SMTP_HOST,
            self.SMTP_PORT,
            self.SMTP_USER[:10] + "***" if len(self.SMTP_USER) > 10 else "***",
            self.SMTP_FROM_EMAIL,
        )

    def is_configured(self) -> bool:
        """Check if SMTP is fully configured."""
        return bool(self.SMTP_HOST and self.SMTP_USER and self.SMTP_PASS)


# Global singleton
email_config = EmailConfig()
