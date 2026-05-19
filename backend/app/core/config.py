import os
from typing import Optional
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "PictureRepair API"
    API_V1_STR: str = "/api/v1"
    ENVIRONMENT: str = "development"
    BACKEND_CORS_ORIGINS: str = "*"
    AUTO_CREATE_TABLES: bool = True

    # Storage Type: 'minio' or 'oss'
    STORAGE_TYPE: str = "oss"

    # Database
    POSTGRES_USER: str
    POSTGRES_PASSWORD: str
    POSTGRES_DB: str
    POSTGRES_HOST: str = "localhost"
    POSTGRES_PORT: str = "5432"

    @property
    def SQLALCHEMY_DATABASE_URI(self) -> str:
        return f"postgresql+asyncpg://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"

    # Redis
    REDIS_HOST: str = "localhost"
    REDIS_PORT: int = 6379

    # MinIO
    MINIO_ROOT_USER: str
    MINIO_ROOT_PASSWORD: str
    MINIO_ENDPOINT: str = "http://localhost:9000"
    MINIO_SERVER_URL: Optional[str] = None
    MINIO_BUCKET_NAME: str = "picturerepair-assets"

    @property
    def MINIO_ACCESS_KEY(self) -> str:
        return self.MINIO_ROOT_USER

    @property
    def MINIO_SECRET_KEY(self) -> str:
        return self.MINIO_ROOT_PASSWORD

    # OSS (Alibaba Cloud Object Storage)
    OSS_ACCESS_KEY_ID: Optional[str] = None
    OSS_ACCESS_KEY_SECRET: Optional[str] = None
    OSS_ENDPOINT: Optional[str] = None
    OSS_BUCKET_NAME: Optional[str] = None
    OSS_PUBLIC_URL: Optional[str] = None

    # Volcengine
    VOLC_ACCESS_KEY: Optional[str] = None
    VOLC_SECRET_KEY: Optional[str] = None

    # Doubao/Seedream API (via Ark SDK)
    ARK_API_KEY: Optional[str] = None

    # Image Model: 'jimeng' (即梦4.0) or 'doubao' (豆包/Seedream 5.0)
    IMAGE_MODEL: str = "doubao"
    MOCK_IMAGE_GENERATION: bool = False

    # WeChat Mini Program
    WECHAT_APPID: Optional[str] = None
    WECHAT_SECRET: Optional[str] = None
    MOCK_WECHAT_LOGIN: bool = False

    # Payment Testing
    PAYMENT_USE_TEST_PRICES: bool = False
    PAYMENT_TEST_PRICE_SINGLE_1_CENTS: int = 1
    PAYMENT_TEST_PRICE_BUNDLE_30_CENTS: int = 2
    PAYMENT_TEST_PRICE_BUNDLE_90_CENTS: int = 3

    # Admin bootstrap
    ADMIN_INITIAL_USERNAME: Optional[str] = None
    ADMIN_INITIAL_PASSWORD: Optional[str] = None
    ADMIN_INITIAL_ROLE: str = "super_admin"

    # JWT Security
    SECRET_KEY: str = "changethis-secret-key-in-production"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7 # 7 days

    class Config:
        env_file = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "..", ".env")
        env_file_encoding = "utf-8"
        case_sensitive = True
        extra = "ignore"

    @property
    def cors_origins_list(self) -> list[str]:
        if not self.BACKEND_CORS_ORIGINS or self.BACKEND_CORS_ORIGINS.strip() == "*":
            return ["*"]
        return [item.strip() for item in self.BACKEND_CORS_ORIGINS.split(",") if item.strip()]

settings = Settings()
