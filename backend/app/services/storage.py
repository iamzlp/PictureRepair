from abc import ABC, abstractmethod
from typing import BinaryIO

class StorageAdapter(ABC):
    @abstractmethod
    def upload_image(self, image_data: bytes, content_type: str = "image/png", folder: str | None = None) -> str:
        pass

    @abstractmethod
    def upload_file(self, file_obj: BinaryIO, original_filename: str, content_type: str, folder: str | None = None) -> str:
        pass

    @abstractmethod
    def download_file(self, filename: str) -> bytes:
        pass

    @abstractmethod
    def normalize_object_key(self, value: str) -> str:
        pass

    @abstractmethod
    def sign_url(self, value: str, expires: int = 600) -> str:
        pass

from app.core.config import settings

class StorageManager:
    def __init__(self):
        self.storage_type = getattr(settings, 'STORAGE_TYPE', 'minio').lower()
        self.adapter = None
        self._init_adapter()

    def _init_adapter(self):
        if self.storage_type == 'oss':
            try:
                from app.services.oss_adapter import oss_adapter
                if not oss_adapter.ready:
                    print(f"[Storage] OSS adapter not ready, falling back to MinIO. Error: {oss_adapter.init_error}")
                    from app.services.minio_adapter import minio_adapter
                    self.adapter = minio_adapter
                    self.storage_type = 'minio'
                else:
                    self.adapter = oss_adapter
                    print("[Storage] OSS adapter initialized successfully")
            except Exception as e:
                print(f"[Storage] Failed to import OSS adapter: {e}, falling back to MinIO")
                from app.services.minio_adapter import minio_adapter
                self.adapter = minio_adapter
                self.storage_type = 'minio'
        else:
            from app.services.minio_adapter import minio_adapter
            self.adapter = minio_adapter
            print("[Storage] Using MinIO adapter")

    def upload_image(self, image_data: bytes, content_type: str = "image/png", folder: str | None = None) -> str:
        if not self.adapter:
            raise RuntimeError("No storage adapter initialized")
        return self.adapter.upload_image(image_data, content_type, folder=folder)

    def upload_file(self, file_obj: BinaryIO, original_filename: str, content_type: str, folder: str | None = None) -> str:
        if not self.adapter:
            raise RuntimeError("No storage adapter initialized")
        return self.adapter.upload_file(file_obj, original_filename, content_type, folder=folder)

    def download_file(self, filename: str) -> bytes:
        if not self.adapter:
            raise RuntimeError("No storage adapter initialized")
        return self.adapter.download_file(filename)

    def normalize_file_reference(self, value: str | None) -> str | None:
        if not value:
            return value
        if not self.adapter:
            raise RuntimeError("No storage adapter initialized")
        return self.adapter.normalize_object_key(value)

    def resolve_public_url(self, value: str | None, expires: int = 600) -> str | None:
        if not value:
            return value
        if not self.adapter:
            raise RuntimeError("No storage adapter initialized")
        return self.adapter.sign_url(value, expires=expires)

storage_manager = StorageManager()
