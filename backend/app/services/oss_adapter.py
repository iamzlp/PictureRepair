from urllib.parse import unquote, urlparse
import uuid

import oss2

from app.core.config import settings

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

    def _default_public_base_url(self) -> str:
        endpoint = settings.OSS_ENDPOINT or ""
        if endpoint.startswith("http://") or endpoint.startswith("https://"):
            return f"{endpoint.rstrip('/')}/{settings.OSS_BUCKET_NAME}".replace(f"/{settings.OSS_BUCKET_NAME}", "")
        return f"https://{settings.OSS_BUCKET_NAME}.{endpoint}"

    def _candidate_base_urls(self) -> list[str]:
        urls = []
        if settings.OSS_PUBLIC_URL:
            urls.append(settings.OSS_PUBLIC_URL.rstrip("/"))
        default_base = self._default_public_base_url().rstrip("/")
        if default_base not in urls:
            urls.append(default_base)
        return urls

    def _build_object_key(self, filename: str, folder: str | None = None) -> str:
        if folder and folder.strip("/"):
            return f"{folder.strip('/')}/{filename}"
        return filename

    def normalize_object_key(self, value: str) -> str:
        normalized = (value or "").strip()
        if not normalized:
            return normalized

        if normalized.startswith("http://") or normalized.startswith("https://"):
            parsed = urlparse(normalized)
            host = parsed.netloc.lower()
            for base_url in self._candidate_base_urls():
                candidate = urlparse(base_url)
                if host == candidate.netloc.lower():
                    return unquote(parsed.path.lstrip("/"))
            return normalized

        return normalized.lstrip("/")

    def sign_url(self, value: str, expires: int = 600) -> str:
        normalized = self.normalize_object_key(value)
        if not normalized or normalized.startswith("http://") or normalized.startswith("https://"):
            return value
        if not self.ready:
            raise RuntimeError(f"OSS not ready: {self.init_error}")
        signed = self.bucket.sign_url("GET", normalized, expires)
        if signed.startswith("http://"):
            signed = "https://" + signed[len("http://"):]
        return signed

    def upload_image(self, image_data: bytes, content_type: str = "image/png", folder: str | None = None) -> str:
        if not self.ready:
            raise RuntimeError(f"OSS not ready: {self.init_error}")
        headers = {'Content-Type': content_type}
        filename = f"{uuid.uuid4()}.png"
        object_key = self._build_object_key(filename, folder)

        self.bucket.put_object(object_key, image_data, headers=headers)

        return object_key

    def upload_file(self, file_obj, original_filename: str, content_type: str, folder: str | None = None) -> str:
        if not self.ready:
            raise RuntimeError(f"OSS not ready: {self.init_error}")
        headers = {'Content-Type': content_type}
        ext = original_filename.split('.')[-1] if '.' in original_filename else 'png'
        filename = f"{uuid.uuid4()}.{ext}"
        object_key = self._build_object_key(filename, folder)

        self.bucket.put_object(object_key, file_obj, headers=headers)

        return object_key

    def download_file(self, filename: str) -> bytes:
        if not self.ready:
            raise RuntimeError(f"OSS not ready: {self.init_error}")
        object_key = self.normalize_object_key(filename)
        if object_key.startswith("http://") or object_key.startswith("https://"):
            raise RuntimeError("Cannot download external URL through OSS adapter")
        result = self.bucket.get_object(object_key)
        return result.read()

oss_adapter = OssAdapter()
