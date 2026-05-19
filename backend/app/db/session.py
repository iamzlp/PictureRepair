from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from app.core.config import settings

engine = create_async_engine(settings.SQLALCHEMY_DATABASE_URI, future=True, echo=True)

SessionLocal = sessionmaker(
    engine, class_=AsyncSession, expire_on_commit=False
)

# Export SessionLocal as async_session_factory for manual session management
async_session_factory = SessionLocal

async def get_db():
    async with SessionLocal() as session:
        yield session
