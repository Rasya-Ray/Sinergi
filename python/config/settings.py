import os
from dataclasses import dataclass, field


@dataclass
class Settings:
    host: str = "127.0.0.1"
    port: int = 8090
    version: str = "2.0.0"
    log_level: str = "info"
    cors_origins: str = "*"
    classifier_backend: str = "rules"
    openclaw_bin: str = "openclaw"
    openclaw_agent_id: str = "nesti"
    chat_history_max: int = 20
    chat_context_max_chars: int = 8000
    rate_limit_per_minute: int = 60
    database_url: str = ""

    def __post_init__(self):
        self.host = os.getenv("NESTI_HOST", self.host)
        self.port = int(os.getenv("NESTI_PORT", str(self.port)))
        self.log_level = os.getenv("NESTI_LOG_LEVEL", self.log_level)
        self.cors_origins = os.getenv("NESTI_CORS_ORIGINS", self.cors_origins)
        self.classifier_backend = os.getenv("NESTI_CLASSIFIER_BACKEND", self.classifier_backend)
        self.openclaw_bin = os.getenv("NESTI_OPENCLAW_BIN", self.openclaw_bin)
        self.openclaw_agent_id = os.getenv("NESTI_OPENCLAW_AGENT_ID", self.openclaw_agent_id)
        self.chat_history_max = int(os.getenv("NESTI_CHAT_HISTORY_MAX", str(self.chat_history_max)))
        self.chat_context_max_chars = int(os.getenv("NESTI_CHAT_CONTEXT_MAX_CHARS", str(self.chat_context_max_chars)))
        self.rate_limit_per_minute = int(os.getenv("NESTI_RATE_LIMIT_PER_MINUTE", str(self.rate_limit_per_minute)))
        self.database_url = os.getenv("DATABASE_URL", self.database_url)


settings = Settings()
