from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.v1.api import api_router
from app.core import security
from app.core.config import settings
from app.db.base import Base
from app.db.session import SessionLocal, engine
from app.models.admin import AdminUser
from sqlalchemy.future import select

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials="*" not in settings.cors_origins_list,
    allow_methods=["*"],
    allow_headers=["*"]
)

# Include Router
app.include_router(api_router, prefix=settings.API_V1_STR)

@app.get("/")
async def root():
    return {"message": "Welcome to PictureRepair API", "docs": "/docs"}

# Startup Event (Create Tables)
# NOTE: In production, use Alembic migrations instead of this.
@app.on_event("startup")
async def startup():
    try:
        if settings.AUTO_CREATE_TABLES:
            async with engine.begin() as conn:
                await conn.run_sync(Base.metadata.create_all)
        if settings.ADMIN_INITIAL_USERNAME and settings.ADMIN_INITIAL_PASSWORD:
            async with SessionLocal() as session:
                result = await session.execute(
                    select(AdminUser).where(AdminUser.username == settings.ADMIN_INITIAL_USERNAME)
                )
                admin_user = result.scalars().first()
                if not admin_user:
                    session.add(
                        AdminUser(
                            username=settings.ADMIN_INITIAL_USERNAME,
                            password_hash=security.get_password_hash(settings.ADMIN_INITIAL_PASSWORD),
                            role=settings.ADMIN_INITIAL_ROLE,
                            is_active=True,
                        )
                    )
                    await session.commit()
                    print(f"Bootstrapped admin user: {settings.ADMIN_INITIAL_USERNAME}")
    except Exception as exc:
        print(f"Startup DB init skipped: {exc}")
