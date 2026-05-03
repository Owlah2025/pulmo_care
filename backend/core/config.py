import os
from pydantic_settings import BaseSettings
from dotenv import load_dotenv

load_dotenv(override=True)

class Settings(BaseSettings):
    PROJECT_NAME: str = "PULMO CARE API"
    VERSION: str = "1.0.0"
    
    # Database Settings
    POSTGRES_USER: str = os.getenv("POSTGRES_USER", "pulmo_user")
    POSTGRES_PASSWORD: str = os.getenv("POSTGRES_PASSWORD", "pulmo_password")
    POSTGRES_SERVER: str = os.getenv("POSTGRES_SERVER", "localhost")
    POSTGRES_PORT: str = os.getenv("POSTGRES_PORT", "5432")
    POSTGRES_DB: str = os.getenv("POSTGRES_DB", "pulmo_care")
    
    @property
    def DATABASE_URL(self) -> str:
        # Fallback to SQLite if not provided, allowing local dev without Docker
        return os.getenv("DATABASE_URL", "sqlite:///./pulmo_care.db")
    
    # Security Settings
    SECRET_KEY: str = os.getenv("SECRET_KEY", "super_secret_key_for_development")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30

settings = Settings()
