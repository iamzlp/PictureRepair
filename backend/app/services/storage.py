from abc import ABC, abstractmethod
from typing import BinaryIO

class StorageAdapter(ABC):
    @abstractmethod
    def upload_image(self, image_data: bytes, content_type: str = "image/png") -> str:
        pass

    @abstractmethod
    def upload_file(self, file_obj: BinaryIO, original_filename: str, content_type: str) -> str:
        pass

    @abstractmethod
    def download_file(self, filename: str) -> bytes:
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
                self.adapter = oss_adapter
            except Exception as e:
                print(f"Failed to initialize OSS adapter: {e}")
                from app.services.minio_adapter import minio_adapter
                self.adapter = minio_adapter
                self.storage_type = 'minio'
        else:
            from app.services.minio_adapter import minio_adapter
            self.adapter = minio_adapter

    def upload_image(self, image_data: bytes, content_type: str = "image/png") -> str:
        if not self.adapter:
            raise RuntimeError("No storage adapter initialized")
        return self.adapter.upload_image(image_data, content_type)

    def upload_file(self, file_obj: BinaryIO, original_filename: str, content_type: str) -> str:
        if not self.adapter:
            raise RuntimeError("No storage adapter initialized")
        return self.adapter.upload_file(file_obj, original_filename, content_type)

    def download_file(self, filename: str) -> bytes:
        if not self.adapter:
            raise RuntimeError("No storage adapter initialized")
        return self.adapter.download_file(filename)

storage_manager = StorageManager()
