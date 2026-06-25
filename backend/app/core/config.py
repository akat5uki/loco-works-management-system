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

    model_config = SettingsConfigDict(
        case_sensitive=True, env_file=".env", extra="ignore"
    )


settings = Settings()
