from typing import Optional
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # Application General Configuration
    PROJECT_NAME: str
    API_V1_STR: str
    BACKEND_HOST: str
    BACKEND_PORT: int
    LOCO_STAGES: str

    # Database Configuration
    POSTGRES_USER: str
    POSTGRES_PASSWORD: str
    POSTGRES_DB: str
    DATABASE_PRIMARY_URL: str
    DATABASE_REPLICA_URL: str
    DB_POOL_SIZE: int
    DB_MAX_OVERFLOW: int
    DB_ECHO: bool

    # Redis Configuration
    REDIS_SENTINELS: Optional[str] = None
    REDIS_MASTER_SET: str
    REDIS_PASSWORD: str
    REDIS_URL: str
    REDIS_SOCKET_TIMEOUT: float

    # Security & Session Configuration
    SECRET_KEY: str
    ALGORITHM: str
    ACCESS_TOKEN_EXPIRE_MINUTES: int
    SESSION_EXPIRE_SECONDS: int
    COOKIE_SECURE_STRICT: bool
    COOKIE_SECURE_EMBED: bool
    WRITE_WINDOW_LAG_SECONDS: int

    # Email OTP Verification Config
    ENABLE_EMAIL_OTP: int
    SMTP_HOST: str
    SMTP_PORT: int
    SMTP_USERNAME: str
    SMTP_PASSWORD: str
    SMTP_FROM_EMAIL: str
    SMTP_USE_TLS: bool
    SMTP_USE_SSL: bool
    OTP_EXPIRE_SECONDS: int
    REGISTRATION_SESSION_EXPIRE_SECONDS: int

    # Administrator Personnel & Registration Staging Configuration
    DEFAULT_ADMIN_TICKET: int = 9999
    DEFAULT_ADMIN_EMAIL: str = "admin@locoworks.local"
    DEFAULT_ADMIN_PASSWORD: str = "AdminPassword123!"
    REGISTRATION_VALIDITY_DAYS: int = 7

    # Chat Configuration Settings
    CHAT_MAX_HISTORY: int = 100
    CHAT_ROOM_ALL: str = "all"
    CHAT_ROOM_SUPERVISOR: str = "supervisor"

    @property
    def loco_stages_list(self) -> list[int]:
        return [int(s.strip()) for s in self.LOCO_STAGES.split(",") if s.strip()]

    model_config = SettingsConfigDict(
        case_sensitive=True, env_file=".env", extra="ignore"
    )


settings = Settings()
