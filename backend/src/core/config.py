from typing import Optional

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    PROJECT_NAME: str = "Loco Works Management System"
    API_V1_STR: str = "/api/v1"

    # Database Configuration
    POSTGRES_USER: str
    POSTGRES_PASSWORD: str
    POSTGRES_DB: str
    DATABASE_PRIMARY_URL: str
    DATABASE_REPLICA_URL: str

    # Redis Configuration
    REDIS_SENTINELS: Optional[str] = None
    REDIS_MASTER_SET: str = "mymaster"
    REDIS_PASSWORD: str
    REDIS_URL: str = "redis://redis:6379/0"

    # Security Configuration
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30

    model_config = SettingsConfigDict(
        case_sensitive=True, env_file=".env", extra="ignore"
    )


settings = Settings()
