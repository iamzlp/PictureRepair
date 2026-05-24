from typing import Any, List
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.future import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api import deps
from app.db.session import get_db
from app.models.user import User
from app.models.photo import Photo
from app.schemas.photo import PhotoResponse
from app.services.storage import storage_manager

router = APIRouter()


def serialize_photo(photo: Photo) -> PhotoResponse:
    return PhotoResponse(
        id=photo.id,
        url=storage_manager.resolve_public_url(photo.url, expires=1800) or "",
        category=photo.category,
        filename=photo.filename,
        created_at=photo.created_at,
    )

@router.post("/upload", response_model=PhotoResponse)
async def upload_photo(
    file: UploadFile = File(...),
    category: str = Form("default"),
    current_user: User = Depends(deps.get_current_user),
    db: AsyncSession = Depends(get_db)
) -> Any:
    """
    Upload a photo to user's gallery.
    """
    print(f"[Upload Photo] User: {current_user.id}, filename: {file.filename}, category: {category}")
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")

    try:
        file_ref = storage_manager.upload_file(file.file, file.filename, file.content_type, folder=category)
        print(f"[Upload Photo] Uploaded to storage, ref: {file_ref}")
    except Exception as e:
        print(f"[Upload Photo] Upload failed: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to upload to storage: {str(e)}")

    photo = Photo(
        user_id=current_user.id,
        url=file_ref,
        filename=file.filename,
        category=category
    )
    db.add(photo)
    await db.commit()
    await db.refresh(photo)
    print(f"[Upload Photo] Saved to DB - id: {photo.id}, ref: {photo.url}")

    return serialize_photo(photo)

@router.get("/", response_model=List[PhotoResponse])
async def list_photos(
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(deps.get_current_user),
    db: AsyncSession = Depends(get_db)
) -> Any:
    """
    List user's photos.
    """
    print(f"[List Photos] User: {current_user.id}, skip: {skip}, limit: {limit}")
    result = await db.execute(
        select(Photo)
        .where(Photo.user_id == current_user.id)
        .order_by(Photo.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    photos = result.scalars().all()
    print(f"[List Photos] Found {len(photos)} photos for user {current_user.id}")
    for photo in photos:
        print(f"[List Photos] Photo - id: {photo.id}, url: {photo.url}, filename: {photo.filename}")
    return [serialize_photo(photo) for photo in photos]

@router.delete("/{photo_id}", response_model=PhotoResponse)
async def delete_photo(
    photo_id: str,
    current_user: User = Depends(deps.get_current_user),
    db: AsyncSession = Depends(get_db)
) -> Any:
    """
    Delete a photo.
    """
    result = await db.execute(
        select(Photo).where(Photo.id == photo_id, Photo.user_id == current_user.id)
    )
    photo = result.scalars().first()
    
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")
        
    await db.delete(photo)
    await db.commit()
    
    return serialize_photo(photo)
