from typing import Optional
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # Application General Configuration
    PROJECT_NAME: str = "Loco Works Management System"
    API_V1_STR: str = "/api/v1"
    BACKEND_HOST: str = "0.0.0.0"
    BACKEND_PORT: int = 8000

    # Database Configuration
    POSTGRES_USER: str
    POSTGRES_PASSWORD: str
    POSTGRES_DB: str
    DATABASE_PRIMARY_URL: str
    DATABASE_REPLICA_URL: str
    DB_POOL_SIZE: int = 20
    DB_MAX_OVERFLOW: int = 10
    DB_ECHO: bool = False

    # Redis Configuration
    REDIS_SENTINELS: Optional[str] = None
    REDIS_MASTER_SET: str = "mymaster"
    REDIS_PASSWORD: str
    REDIS_URL: str = "redis://redis:6379/0"
    REDIS_SOCKET_TIMEOUT: float = 10.0

    # Security & Session Configuration
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    SESSION_EXPIRE_SECONDS: int = 1800
    COOKIE_SECURE: bool = False
    WRITE_WINDOW_LAG_SECONDS: int = 2

    # Email OTP Verification Config
    ENABLE_EMAIL_OTP: int = 0
    SMTP_HOST: str = "mailpit"
    SMTP_PORT: int = 1025
    SMTP_USERNAME: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM_EMAIL: str = "no-reply@locoworks.com"
    SMTP_USE_TLS: bool = False
    SMTP_USE_SSL: bool = False
    OTP_EXPIRE_SECONDS: int = 180
    REGISTRATION_SESSION_EXPIRE_SECONDS: int = 180

    model_config = SettingsConfigDict(
        case_sensitive=True, env_file=".env", extra="ignore"
    )


settings = Settings()
