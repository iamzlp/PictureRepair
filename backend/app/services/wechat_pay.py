import base64
import json
import time
import uuid
from functools import lru_cache
from typing import Any

import requests
from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from app.core.config import settings


class WechatPayError(Exception):
    pass


@lru_cache(maxsize=1)
def load_merchant_private_key():
    path = settings.WECHAT_PAY_PRIVATE_KEY_PATH
    if not path:
        raise WechatPayError("WECHAT_PAY_PRIVATE_KEY_PATH is not configured")
    with open(path, "rb") as fp:
        return serialization.load_pem_private_key(fp.read(), password=None)


class WechatPayService:
    def __init__(self) -> None:
        self.base_url = "https://api.mch.weixin.qq.com"
        self._platform_cert_cache: dict[str, Any] = {}
        self._platform_cert_cache_expires_at = 0.0

    def ensure_configured(self) -> None:
        required = {
            "WECHAT_APPID": settings.WECHAT_APPID,
            "WECHAT_PAY_MCH_ID": settings.WECHAT_PAY_MCH_ID,
            "WECHAT_PAY_API_V3_KEY": settings.WECHAT_PAY_API_V3_KEY,
            "WECHAT_PAY_CERT_SERIAL_NO": settings.WECHAT_PAY_CERT_SERIAL_NO,
            "WECHAT_PAY_PRIVATE_KEY_PATH": settings.WECHAT_PAY_PRIVATE_KEY_PATH,
            "WECHAT_PAY_NOTIFY_URL": settings.WECHAT_PAY_NOTIFY_URL,
        }
        missing = [key for key, value in required.items() if not value]
        if missing:
            raise WechatPayError(f"WeChat Pay config missing: {', '.join(missing)}")

    def _sign_message(self, message: str) -> str:
        private_key = load_merchant_private_key()
        signature = private_key.sign(
            message.encode("utf-8"),
            padding.PKCS1v15(),
            hashes.SHA256(),
        )
        return base64.b64encode(signature).decode("utf-8")

    def _build_authorization(self, method: str, canonical_url: str, body: str = "") -> str:
        timestamp = str(int(time.time()))
        nonce_str = uuid.uuid4().hex
        message = f"{method}\n{canonical_url}\n{timestamp}\n{nonce_str}\n{body}\n"
        signature = self._sign_message(message)
        return (
            'WECHATPAY2-SHA256-RSA2048 '
            f'mchid="{settings.WECHAT_PAY_MCH_ID}",'
            f'nonce_str="{nonce_str}",'
            f'signature="{signature}",'
            f'timestamp="{timestamp}",'
            f'serial_no="{settings.WECHAT_PAY_CERT_SERIAL_NO}"'
        )

    def _request(self, method: str, path: str, payload: dict[str, Any] | None = None) -> dict[str, Any]:
        self.ensure_configured()
        body = json.dumps(payload, ensure_ascii=False, separators=(",", ":")) if payload is not None else ""
        headers = {
            "Accept": "application/json",
            "Content-Type": "application/json",
            "User-Agent": "PictureRepair/1.0",
            "Authorization": self._build_authorization(method.upper(), path, body),
        }
        response = requests.request(
            method=method.upper(),
            url=f"{self.base_url}{path}",
            headers=headers,
            data=body.encode("utf-8") if body else None,
            timeout=30,
        )
        response_text = response.text or ""
        if response.status_code < 200 or response.status_code >= 300:
            raise WechatPayError(f"WeChat Pay API error {response.status_code}: {response_text[:500]}")
        if not response_text.strip():
            return {}
        try:
            return response.json()
        except ValueError as exc:
            raise WechatPayError(f"WeChat Pay returned invalid JSON: {response_text[:500]}") from exc

    def create_jsapi_order(
        self,
        *,
        description: str,
        out_trade_no: str,
        amount_cents: int,
        openid: str,
    ) -> dict[str, Any]:
        payload = {
            "appid": settings.WECHAT_APPID,
            "mchid": settings.WECHAT_PAY_MCH_ID,
            "description": description,
            "out_trade_no": out_trade_no,
            "notify_url": settings.WECHAT_PAY_NOTIFY_URL,
            "amount": {
                "total": amount_cents,
                "currency": "CNY",
            },
            "payer": {
                "openid": openid,
            },
        }
        response = self._request("POST", "/v3/pay/transactions/jsapi", payload)
        prepay_id = str(response.get("prepay_id") or "").strip()
        if not prepay_id:
            raise WechatPayError(f"WeChat Pay create order missing prepay_id: {json.dumps(response, ensure_ascii=False)}")

        timestamp = str(int(time.time()))
        nonce_str = uuid.uuid4().hex
        package = f"prepay_id={prepay_id}"
        pay_message = f"{settings.WECHAT_APPID}\n{timestamp}\n{nonce_str}\n{package}\n"
        pay_sign = self._sign_message(pay_message)
        return {
            "prepay_id": prepay_id,
            "timeStamp": timestamp,
            "nonceStr": nonce_str,
            "package": package,
            "signType": "RSA",
            "paySign": pay_sign,
            "raw_response": response,
        }

    def _decrypt_aes_gcm(self, *, nonce: str, ciphertext: str, associated_data: str = "") -> str:
        key = (settings.WECHAT_PAY_API_V3_KEY or "").encode("utf-8")
        if len(key) != 32:
            raise WechatPayError("WECHAT_PAY_API_V3_KEY must be 32 bytes")
        aesgcm = AESGCM(key)
        plaintext = aesgcm.decrypt(
            nonce.encode("utf-8"),
            base64.b64decode(ciphertext),
            associated_data.encode("utf-8") if associated_data else None,
        )
        return plaintext.decode("utf-8")

    def decrypt_notification_resource(self, resource: dict[str, Any]) -> dict[str, Any]:
        plaintext = self._decrypt_aes_gcm(
            nonce=str(resource.get("nonce") or ""),
            ciphertext=str(resource.get("ciphertext") or ""),
            associated_data=str(resource.get("associated_data") or ""),
        )
        try:
            return json.loads(plaintext)
        except ValueError as exc:
            raise WechatPayError(f"Invalid decrypted WeChat Pay resource: {plaintext[:500]}") from exc

    def _load_platform_certificates(self) -> dict[str, Any]:
        now = time.time()
        if self._platform_cert_cache and now < self._platform_cert_cache_expires_at:
            return self._platform_cert_cache

        response = self._request("GET", "/v3/certificates")
        certs: dict[str, Any] = {}
        for item in response.get("data") or []:
            serial_no = str(item.get("serial_no") or "").strip()
            encrypt_certificate = item.get("encrypt_certificate") or {}
            certificate_pem = self._decrypt_aes_gcm(
                nonce=str(encrypt_certificate.get("nonce") or ""),
                ciphertext=str(encrypt_certificate.get("ciphertext") or ""),
                associated_data=str(encrypt_certificate.get("associated_data") or ""),
            )
            cert = x509.load_pem_x509_certificate(certificate_pem.encode("utf-8"))
            certs[serial_no] = cert.public_key()

        if not certs:
            raise WechatPayError("No WeChat Pay platform certificates available")

        self._platform_cert_cache = certs
        self._platform_cert_cache_expires_at = now + 6 * 60 * 60
        return certs

    def verify_notification(self, headers: dict[str, str], body: str) -> None:
        serial_no = str(headers.get("Wechatpay-Serial") or headers.get("wechatpay-serial") or "").strip()
        signature = str(headers.get("Wechatpay-Signature") or headers.get("wechatpay-signature") or "").strip()
        timestamp = str(headers.get("Wechatpay-Timestamp") or headers.get("wechatpay-timestamp") or "").strip()
        nonce = str(headers.get("Wechatpay-Nonce") or headers.get("wechatpay-nonce") or "").strip()

        if not serial_no or not signature or not timestamp or not nonce:
            raise WechatPayError("WeChat Pay notify headers missing")

        public_keys = self._load_platform_certificates()
        public_key = public_keys.get(serial_no)
        if public_key is None:
            raise WechatPayError(f"WeChat Pay platform certificate not found for serial {serial_no}")

        message = f"{timestamp}\n{nonce}\n{body}\n".encode("utf-8")
        public_key.verify(
            base64.b64decode(signature),
            message,
            padding.PKCS1v15(),
            hashes.SHA256(),
        )


wechat_pay_service = WechatPayService()
