import boto3
from botocore.client import Config
from app.core.config import settings
import io
import uuid
from urllib.parse import unquote, urlparse

class MinioAdapter:
    def __init__(self):
        self.ready = False
        self.init_error = ""
        self.s3_client = boto3.client(
            's3',
            endpoint_url=settings.MINIO_ENDPOINT,
            aws_access_key_id=settings.MINIO_ACCESS_KEY,
            aws_secret_access_key=settings.MINIO_SECRET_KEY,
            config=Config(signature_version='s3v4'),
            region_name='us-east-1' # MinIO ignores this but boto3 needs it
        )
        self.bucket_name = settings.MINIO_BUCKET_NAME
        
        # Ensure bucket exists
        try:
            self.s3_client.head_bucket(Bucket=self.bucket_name)
            self.ready = True
        except Exception as exc:
            self.init_error = str(exc)
            try:
                self.s3_client.create_bucket(Bucket=self.bucket_name)
                self.ready = True
            except Exception as exc2:
                self.init_error = str(exc2)
                self.ready = False

    def _get_public_url(self, filename: str) -> str:
        # Prioritize MINIO_SERVER_URL (public accessible URL)
        base_url = settings.MINIO_SERVER_URL or settings.MINIO_ENDPOINT
        if base_url.endswith("/"):
            base_url = base_url[:-1]
        return f"{base_url}/{self.bucket_name}/{filename}"

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
            endpoint = urlparse((settings.MINIO_SERVER_URL or settings.MINIO_ENDPOINT or "").rstrip("/"))
            if endpoint.netloc and parsed.netloc.lower() == endpoint.netloc.lower():
                path = unquote(parsed.path.lstrip("/"))
                prefix = f"{self.bucket_name}/"
                if path.startswith(prefix):
                    return path[len(prefix):]
            return normalized

        return normalized.lstrip("/")

    def sign_url(self, value: str, expires: int = 600) -> str:
        normalized = self.normalize_object_key(value)
        if not normalized or normalized.startswith("http://") or normalized.startswith("https://"):
            return value
        return self.s3_client.generate_presigned_url(
            "get_object",
            Params={"Bucket": self.bucket_name, "Key": normalized},
            ExpiresIn=expires,
        )

    def upload_image(self, image_data: bytes, content_type: str = "image/png", folder: str | None = None) -> str:
        """
        Upload image bytes to MinIO and return the URL.
        """
        if not self.ready:
            raise RuntimeError(f"MinIO not ready: {self.init_error}")
        filename = f"{uuid.uuid4()}.png"
        object_key = self._build_object_key(filename, folder)
        
        self.s3_client.upload_fileobj(
            io.BytesIO(image_data),
            self.bucket_name,
            object_key,
            ExtraArgs={'ContentType': content_type}
        )
        
        return object_key

    def upload_file(self, file_obj, original_filename: str, content_type: str, folder: str | None = None) -> str:
        """
        Upload file object (like UploadFile.file) to MinIO.
        """
        if not self.ready:
            raise RuntimeError(f"MinIO not ready: {self.init_error}")
        ext = original_filename.split('.')[-1] if '.' in original_filename else 'png'
        filename = f"{uuid.uuid4()}.{ext}"
        object_key = self._build_object_key(filename, folder)
        
        self.s3_client.upload_fileobj(
            file_obj,
            self.bucket_name,
            object_key,
            ExtraArgs={'ContentType': content_type}
        )
        
        return object_key

minio_adapter = MinioAdapter()
