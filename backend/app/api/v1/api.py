from fastapi import APIRouter
from app.api.v1.endpoints import admin, tasks, auth, feedback, photos, payments, repair, routes

api_router = APIRouter()
api_router.include_router(admin.router, prefix="/admin", tags=["admin"])
api_router.include_router(tasks.router, prefix="/tasks", tags=["tasks"])
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(feedback.router, prefix="/feedback", tags=["feedback"])
api_router.include_router(photos.router, prefix="/photos", tags=["photos"])
api_router.include_router(payments.router, prefix="/payments", tags=["payments"])
api_router.include_router(repair.router, prefix="/repair", tags=["repair"])
api_router.include_router(routes.router, prefix="/routes", tags=["routes"])
