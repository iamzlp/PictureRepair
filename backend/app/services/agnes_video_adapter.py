import json

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

    def _truncate(self, value: str, limit: int = 1200) -> str:
        text = str(value or "")
        if len(text) <= limit:
            return text
        return f"{text[:limit]}...(truncated {len(text) - limit} chars)"

    def _dump_payload(self, payload: dict | list | str | None, limit: int = 2000) -> str:
        try:
            text = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
        except Exception:
            text = str(payload)
        return self._truncate(text, limit)

    def create_video_task(self, prompt: str, image_url: str, width: int | None = None, height: int | None = None) -> dict:
        payload = {
            "model": "agnes-video-v2.0",
            "prompt": prompt,
            "image": image_url,
            "num_frames": 121,
            "frame_rate": 24,
            "negative_prompt": settings.AGNES_VIDEO_NEGATIVE_PROMPT,
        }
        if isinstance(width, int) and width > 0:
            payload["width"] = width
        if isinstance(height, int) and height > 0:
            payload["height"] = height
        print(
            "[Agnes Video Create Request] "
            f"endpoint={self.base_url}/videos, "
            f"image={self._truncate(image_url, 300)}, "
            f"payload={self._dump_payload(payload)}"
        )
        response = requests.post(
            f"{self.base_url}/videos",
            headers=self._headers(),
            json=payload,
            timeout=120,
        )
        print(
            "[Agnes Video Create Response] "
            f"status_code={response.status_code}, body={self._truncate(response.text, 2000)}"
        )
        if response.status_code < 200 or response.status_code >= 300:
            raise Exception(f"Agnes video create failed: {response.status_code} {response.text}")
        return response.json()

    def get_video_task(self, task_id: str) -> dict:
        print(f"[Agnes Video Poll Request] task_id={task_id}, endpoint={self.base_url}/videos/{task_id}")
        response = requests.get(
            f"{self.base_url}/videos/{task_id}",
            headers=self._headers(),
            timeout=120,
        )
        print(
            "[Agnes Video Poll Response] "
            f"task_id={task_id}, status_code={response.status_code}, body={self._truncate(response.text, 3000)}"
        )
        if response.status_code < 200 or response.status_code >= 300:
            raise Exception(f"Agnes video poll failed: {response.status_code} {response.text}")
        return response.json()

    def download_video(self, url: str) -> tuple[bytes, str]:
        print(f"[Agnes Video Download Request] url={self._truncate(url, 500)}")
        response = requests.get(url, timeout=180)
        print(
            "[Agnes Video Download Response] "
            f"status_code={response.status_code}, content_type={response.headers.get('Content-Type', '')}, "
            f"content_length={len(response.content or b'')}"
        )
        if response.status_code != 200:
            raise Exception(f"Failed to download video from {url}")
        return response.content, response.headers.get("Content-Type", "video/mp4")


agnes_video_adapter = AgnesVideoAdapter()
