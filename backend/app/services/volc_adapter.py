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
        primary_model = str(settings.IMAGE_MODEL or self.model_type or "agnes").strip().lower()
        fallback_model = str(settings.IMAGE_MODEL_FALLBACK or "").strip().lower()
        auto_fallback = bool(settings.IMAGE_MODEL_AUTO_FALLBACK)

        print(
            f"[Image Generation] primary={primary_model}, "
            f"fallback={fallback_model or 'none'}, auto_fallback={auto_fallback}"
        )

        attempted_errors: list[str] = []
        models_to_try = [primary_model]
        if auto_fallback and fallback_model and fallback_model != primary_model:
            models_to_try.append(fallback_model)

        for index, model_name in enumerate(models_to_try):
            try:
                return self._generate_with_model(
                    model_name=model_name,
                    prompt=prompt,
                    style=style,
                    aspect_ratio=aspect_ratio,
                    reference_image_urls=reference_image_urls,
                )
            except Exception as error:
                error_message = f"{model_name}: {error}"
                attempted_errors.append(error_message)
                is_last_attempt = index == len(models_to_try) - 1
                if is_last_attempt:
                    raise Exception(
                        " | ".join(attempted_errors)
                    ) from error
                print(f"[Image Generation] {model_name} failed, fallback to {models_to_try[index + 1]}: {error}")

        raise Exception("No image model was executed")

    def _generate_with_model(
        self,
        model_name: str,
        prompt: str,
        style: str,
        aspect_ratio: str,
        reference_image_urls: list[str] = None,
    ) -> bytes:
        if model_name == 'doubao':
            return self._generate_doubao(prompt, aspect_ratio, reference_image_urls)
        if model_name == 'agnes':
            return self._generate_agnes(prompt, style, aspect_ratio, reference_image_urls)
        if model_name == 'jimeng':
            return self._generate_jimeng(prompt, style, aspect_ratio, reference_image_urls)
        raise Exception(f"Unsupported IMAGE_MODEL: {model_name}")

    def _size_from_aspect_ratio(self, aspect_ratio: str) -> str:
        size_map = {
            "1:1": "1024x1024",
            "3:4": "768x1024",
            "4:3": "1024x768",
            "16:9": "1280x720",
            "9:16": "720x1280",
        }
        return size_map.get(aspect_ratio, "1024x1024")

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

    def _generate_agnes(self, prompt: str, style: str, aspect_ratio: str, reference_image_urls: list[str] = None) -> bytes:
        if not settings.AGNES_API_KEY:
            raise Exception("AGNES_API_KEY not configured")

        normalized_style = style.value if hasattr(style, "value") else str(style or "").strip()
        full_prompt = prompt
        if normalized_style and normalized_style.lower() not in prompt.lower():
            full_prompt = f"{normalized_style} style, {prompt}"

        payload = {
            "model": "agnes-image-2.1-flash",
            "prompt": full_prompt,
            "size": self._size_from_aspect_ratio(aspect_ratio),
        }

        normalized_urls = []
        if reference_image_urls:
            normalized_urls = [self._normalize_url(url) for url in reference_image_urls[:4] if url]
        if normalized_urls:
            payload["extra_body"] = {
                "image": normalized_urls,
                "response_format": "url",
            }

        endpoint = f"{settings.AGNES_API_BASE_URL.rstrip('/')}/images/generations"
        headers = {
            "Authorization": f"Bearer {settings.AGNES_API_KEY}",
            "Content-Type": "application/json",
        }

        print(f"[Agnes Request] endpoint={endpoint}, size={payload['size']}, reference_urls={normalized_urls}")
        resp = requests.post(endpoint, headers=headers, json=payload, timeout=120)
        if resp.status_code < 200 or resp.status_code >= 300:
            raise Exception(f"Agnes request failed: {resp.status_code} {resp.text}")

        try:
            resp_json = resp.json()
        except Exception as error:
            raise Exception(f"Invalid Agnes response: {error}") from error

        image_url = self._extract_agnes_image_url(resp_json)
        if not image_url:
            raise Exception(f"No image URL in Agnes response: {resp_json}")

        print(f"[Agnes Response] {image_url}")
        return self._download_image(image_url)

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
        resp = requests.get(url, timeout=120)
        if resp.status_code == 200:
            return resp.content
        raise Exception(f"Failed to download image from {url}")

    def _extract_agnes_image_url(self, payload: dict) -> str | None:
        if not isinstance(payload, dict):
            return None

        candidates = []
        data = payload.get("data")
        if isinstance(data, list):
            candidates.extend(data)
        elif isinstance(data, dict):
            candidates.append(data)

        output = payload.get("output")
        if isinstance(output, list):
            candidates.extend(output)
        elif isinstance(output, dict):
            candidates.append(output)

        for item in candidates:
            if not isinstance(item, dict):
                continue
            for key in ("url", "image_url"):
                value = item.get(key)
                if isinstance(value, str) and value.startswith("http"):
                    return value
            images = item.get("images")
            if isinstance(images, list):
                for image in images:
                    if isinstance(image, str) and image.startswith("http"):
                        return image
                    if isinstance(image, dict):
                        value = image.get("url") or image.get("image_url")
                        if isinstance(value, str) and value.startswith("http"):
                            return value

        for key in ("url", "image_url"):
            value = payload.get(key)
            if isinstance(value, str) and value.startswith("http"):
                return value

        return None

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
