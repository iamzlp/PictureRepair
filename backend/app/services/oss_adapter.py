import oss2
from app.core.config import settings
import uuid

class OssAdapter:
    def __init__(self):
        self.ready = False
        self.init_error = ""
        try:
            self.auth = oss2.Auth(settings.OSS_ACCESS_KEY_ID, settings.OSS_ACCESS_KEY_SECRET)
            self.bucket = oss2.Bucket(self.auth, settings.OSS_ENDPOINT, settings.OSS_BUCKET_NAME)
            self.bucket.get_bucket_info()
            self.ready = True
        except Exception as exc:
            self.init_error = str(exc)
            self.ready = False

    def _get_public_url(self, filename: str) -> str:
        base_url = settings.OSS_PUBLIC_URL.rstrip('/') if settings.OSS_PUBLIC_URL else f"https://{settings.OSS_BUCKET_NAME}.{settings.OSS_ENDPOINT}"
        return f"{base_url}/{filename}"

    def upload_image(self, image_data: bytes, content_type: str = "image/png") -> str:
        if not self.ready:
            raise RuntimeError(f"OSS not ready: {self.init_error}")
        headers = {'Content-Type': content_type}
        filename = f"{uuid.uuid4()}.png"

        self.bucket.put_object(filename, image_data, headers=headers)

        return self._get_public_url(filename)

    def upload_file(self, file_obj, original_filename: str, content_type: str) -> str:
        if not self.ready:
            raise RuntimeError(f"OSS not ready: {self.init_error}")
        headers = {'Content-Type': content_type}
        ext = original_filename.split('.')[-1] if '.' in original_filename else 'png'
        filename = f"{uuid.uuid4()}.{ext}"

        self.bucket.put_object(filename, file_obj, headers=headers)

        return self._get_public_url(filename)

    def download_file(self, filename: str) -> bytes:
        if not self.ready:
            raise RuntimeError(f"OSS not ready: {self.init_error}")
        result = self.bucket.get_object(filename)
        return result.read()

oss_adapter = OssAdapter()
