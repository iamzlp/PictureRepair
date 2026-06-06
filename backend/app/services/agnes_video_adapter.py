import requests

from app.core.config import settings


class AgnesVideoAdapter:
    def __init__(self):
        self.base_url = settings.AGNES_API_BASE_URL.rstrip("/")
        self.api_key = settings.AGNES_API_KEY

    def _headers(self) -> dict[str, str]:
        if not self.api_key:
            raise Exception("AGNES_API_KEY not configured")
        return {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

    def create_video_task(self, prompt: str, image_url: str) -> dict:
        payload = {
            "model": "agnes-video-v2.0",
            "prompt": prompt,
            "image": image_url,
            "num_frames": 121,
            "frame_rate": 24,
            "negative_prompt": settings.AGNES_VIDEO_NEGATIVE_PROMPT,
        }
        response = requests.post(
            f"{self.base_url}/videos",
            headers=self._headers(),
            json=payload,
            timeout=120,
        )
        if response.status_code < 200 or response.status_code >= 300:
            raise Exception(f"Agnes video create failed: {response.status_code} {response.text}")
        return response.json()

    def get_video_task(self, task_id: str) -> dict:
        response = requests.get(
            f"{self.base_url}/videos/{task_id}",
            headers=self._headers(),
            timeout=120,
        )
        if response.status_code < 200 or response.status_code >= 300:
            raise Exception(f"Agnes video poll failed: {response.status_code} {response.text}")
        return response.json()

    def download_video(self, url: str) -> tuple[bytes, str]:
        response = requests.get(url, timeout=180)
        if response.status_code != 200:
            raise Exception(f"Failed to download video from {url}")
        return response.content, response.headers.get("Content-Type", "video/mp4")


agnes_video_adapter = AgnesVideoAdapter()
