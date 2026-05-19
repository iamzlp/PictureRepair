import json
import requests
import time
import asyncio
import base64
from app.core.config import settings
from app.services.volc_signer import VolcSigner

class VolcAdapter:
    def __init__(self):
        self.ak = settings.VOLC_ACCESS_KEY
        self.sk = settings.VOLC_SECRET_KEY
        self.region = "cn-beijing"
        self.service = "cv"
        self.host = "visual.volcengineapi.com"
        self.endpoint = "https://visual.volcengineapi.com"
        self.model_type = getattr(settings, 'IMAGE_MODEL', 'doubao')

    def generate_image(self, prompt: str, style: str, aspect_ratio: str, reference_image_urls: list[str] = None) -> bytes:
        print(f"[Image Generation] Using model: {self.model_type.upper()} (IMAGE_MODEL={settings.IMAGE_MODEL})")
        if self.model_type == 'doubao':
            return self._generate_doubao(prompt, aspect_ratio, reference_image_urls)
        else:
            return self._generate_jimeng(prompt, style, aspect_ratio, reference_image_urls)

    def _generate_doubao(self, prompt: str, aspect_ratio: str, reference_image_urls: list[str] = None) -> bytes:
        from volcenginesdkarkruntime import Ark

        if not settings.ARK_API_KEY:
            raise Exception("ARK_API_KEY not configured")

        size_map = {
            "1:1": "2k",
            "3:4": "2k",
            "16:9": "2k",
            "9:16": "2k",
            "4:3": "2k",
        }
        size = size_map.get(aspect_ratio, "2k")

        client = Ark(
            base_url="https://ark.cn-beijing.volces.com/api/v3",
            api_key=settings.ARK_API_KEY
        )

        image_args = {}
        if reference_image_urls:
            normalized_urls = [self._normalize_url(url) for url in reference_image_urls[:14]]
            image_args["image"] = normalized_urls

        print(f"[Doubao Request] prompt={prompt}, size={size}, reference_urls={reference_image_urls}")

        response = client.images.generate(
            model="doubao-seedream-5-0-260128",
            prompt=prompt,
            size=size,
            output_format="png",
            response_format="url",
            watermark=False,
            **image_args
        )

        print(f"[Doubao Response] {response.data[0].url if response.data else 'No data'}")

        if not response.data or not response.data[0].url:
            raise Exception("No image URL in Doubao response")

        return self._download_image(response.data[0].url)

    def _generate_jimeng(self, prompt: str, style: str, aspect_ratio: str, reference_image_urls: list[str] = None) -> bytes:
        task_id = self._submit_task_jimeng(prompt, style, aspect_ratio, reference_image_urls)
        if not task_id:
            raise Exception("Failed to submit Jimeng task")

        for _ in range(90):
            status, result_data = self._get_task_result_jimeng(task_id)

            if status == "success":
                if isinstance(result_data, bytes):
                    return result_data
                elif isinstance(result_data, str) and result_data.startswith("http"):
                    return self._download_image(result_data)
                else:
                    raise Exception(f"Unknown result data format: {type(result_data)}")

            elif status == "failed":
                raise Exception("Jimeng Task failed")

            time.sleep(2)

        raise Exception("Timeout waiting for Jimeng task completion")

    def _normalize_url(self, url: str) -> str:
        if 'oss-cn-' in url or 'aliyuncs.com' in url:
            return url
        if "10.0.2.2" in url:
            return url.replace("10.0.2.2", "localhost")
        if (("localhost:" in url or "127.0.0.1:" in url) and "/api/v1/buckets/" in url):
            try:
                from urllib.parse import urlparse, parse_qs
                parsed = urlparse(url)
                prefix = parse_qs(parsed.query).get('prefix', [''])[0]
                if prefix:
                    base = (settings.MINIO_ENDPOINT or "http://localhost:9000").rstrip("/")
                    return f"{base}/{settings.MINIO_BUCKET_NAME}/{prefix}"
            except Exception:
                pass
        return url

    def _download_image(self, url: str) -> bytes:
        resp = requests.get(url)
        if resp.status_code == 200:
            return resp.content
        raise Exception(f"Failed to download image from {url}")

    def _submit_task_jimeng(self, prompt: str, style: str, aspect_ratio: str, reference_image_urls: list[str] = None) -> str:
        action = "CVSync2AsyncSubmitTask"
        version = "2022-08-31"

        width, height = 1024, 1024
        if aspect_ratio == "16:9":
            width, height = 1280, 720
        elif aspect_ratio == "9:16":
            width, height = 720, 1280
        elif aspect_ratio == "3:4":
            width, height = 768, 1024

        normalized_style = style.value if hasattr(style, "value") else str(style or "").strip()
        if normalized_style:
            full_prompt = f"{normalized_style} style, {prompt}"
        else:
            full_prompt = prompt

        payload = {
            "req_key": "jimeng_t2i_v40",
            "prompt": full_prompt,
            "model_version": "4.0",
            "req_schedule_conf": "general_v20_9",
            "llm_m_config": {
                "width": width,
                "height": height
            }
        }

        if reference_image_urls:
            try:
                image_urls_list = []
                for url in reference_image_urls[:4]:
                    normalized_url = self._normalize_url(url)
                    image_urls_list.append(normalized_url)
                print(f"[Jimeng image_urls_list] {image_urls_list}")
                if image_urls_list:
                    payload["image_urls"] = image_urls_list
                    if "参考" not in full_prompt and "reference" not in full_prompt.lower():
                        payload["prompt"] = f"严格参考输入图片人物与场景，{full_prompt}"
            except Exception as e:
                print(f"Failed to process reference image: {e}")

        body_str = json.dumps(payload)
        print(f"[Jimeng Request Body] {body_str}")

        params = {
            "Action": action,
            "Version": version
        }

        headers = {
            "Host": self.host,
            "Content-Type": "application/json"
        }

        auth_headers = VolcSigner.sign_request(
            "POST", "/", params, headers, body_str,
            self.ak, self.sk, self.region, self.service
        )
        headers.update(auth_headers)

        resp = requests.post(
            self.endpoint,
            params=params,
            headers=headers,
            data=body_str
        )

        if resp.status_code != 200:
            raise Exception(f"Submit Failed: {resp.status_code} {resp.text}")

        resp_json = resp.json()
        if "data" in resp_json and "task_id" in resp_json["data"]:
            return resp_json["data"]["task_id"]

        raise Exception(f"No task_id in response: {resp_json}")

    def _get_task_result_jimeng(self, task_id: str):
        action = "CVSync2AsyncGetResult"
        version = "2022-08-31"

        payload = {
            "req_key": "jimeng_t2i_v40",
            "task_id": task_id
        }
        body_str = json.dumps(payload)

        params = {
            "Action": action,
            "Version": version
        }

        headers = {
            "Host": self.host,
            "Content-Type": "application/json"
        }

        auth_headers = VolcSigner.sign_request(
            "POST", "/", params, headers, body_str,
            self.ak, self.sk, self.region, self.service
        )
        headers.update(auth_headers)

        resp = requests.post(
            self.endpoint,
            params=params,
            headers=headers,
            data=body_str
        )

        if resp.status_code != 200:
            print(f"Poll Error: {resp.status_code} {resp.text}")
            return "processing", None

        resp_json = resp.json()
        if "data" not in resp_json:
            return "processing", None

        data = resp_json["data"]
        status = data.get("status")

        if status == 2 or status == "2" or status == "success" or status == "done":
            b64_list = data.get("binary_data_base64")
            if b64_list and isinstance(b64_list, list) and len(b64_list) > 0:
                try:
                    return "success", base64.b64decode(b64_list[0])
                except Exception as e:
                    print(f"Failed to decode base64: {e}")
                    return "failed", None

            urls = data.get("image_urls")
            if urls and isinstance(urls, list) and len(urls) > 0:
                return "success", urls[0]

            resp_data = data.get("resp_data")
            if resp_data:
                if isinstance(resp_data, str):
                    try:
                        resp_data = json.loads(resp_data)
                    except:
                        pass
                if isinstance(resp_data, dict):
                    urls = resp_data.get("image_urls")
                    if urls and len(urls) > 0:
                        return "success", urls[0]

            return "failed", None

        elif status == 3 or status == "3" or status == "failed":
            return "failed", None
        else:
            return "processing", None

volc_adapter = VolcAdapter()
