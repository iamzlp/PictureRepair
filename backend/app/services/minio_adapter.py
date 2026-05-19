import boto3
from botocore.client import Config
from app.core.config import settings
import io
import uuid

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

    def upload_image(self, image_data: bytes, content_type: str = "image/png") -> str:
        """
        Upload image bytes to MinIO and return the URL.
        """
        if not self.ready:
            raise RuntimeError(f"MinIO not ready: {self.init_error}")
        filename = f"{uuid.uuid4()}.png"
        
        self.s3_client.upload_fileobj(
            io.BytesIO(image_data),
            self.bucket_name,
            filename,
            ExtraArgs={'ContentType': content_type}
        )
        
        return self._get_public_url(filename)

    def upload_file(self, file_obj, original_filename: str, content_type: str) -> str:
        """
        Upload file object (like UploadFile.file) to MinIO.
        """
        if not self.ready:
            raise RuntimeError(f"MinIO not ready: {self.init_error}")
        ext = original_filename.split('.')[-1] if '.' in original_filename else 'png'
        filename = f"{uuid.uuid4()}.{ext}"
        
        self.s3_client.upload_fileobj(
            file_obj,
            self.bucket_name,
            filename,
            ExtraArgs={'ContentType': content_type}
        )
        
        return self._get_public_url(filename)

minio_adapter = MinioAdapter()
