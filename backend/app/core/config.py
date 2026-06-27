from typing import Optional

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    PROJECT_NAME: str
    API_V1_STR: str

    # Database Configuration
    POSTGRES_USER: str
    POSTGRES_PASSWORD: str
    POSTGRES_DB: str
    DATABASE_PRIMARY_URL: str
    DATABASE_REPLICA_URL: str

    # Redis Configuration
    REDIS_SENTINELS: Optional[str] = None
    REDIS_MASTER_SET: str
    REDIS_PASSWORD: str
    REDIS_URL: str

    # Security Configuration
    SECRET_KEY: str
    ALGORITHM: str
    ACCESS_TOKEN_EXPIRE_MINUTES: int

    # Email OTP Config
    ENABLE_EMAIL_OTP: int = 0
    SMTP_HOST: str = "mailpit"
    SMTP_PORT: int = 1025
    SMTP_USERNAME: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM_EMAIL: str = "no-reply@locoworks.com"
    SMTP_USE_TLS: bool = False
    SMTP_USE_SSL: bool = False

    model_config = SettingsConfigDict(
        case_sensitive=True, env_file=".env", extra="ignore"
    )


settings = Settings()
