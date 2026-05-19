import hashlib
import hmac
import datetime
from urllib.parse import quote

class VolcSigner:
    @staticmethod
    def hmac_sha256(key: bytes, content: str):
        return hmac.new(key, content.encode("utf-8"), hashlib.sha256).digest()

    @staticmethod
    def sha256(content: str):
        return hashlib.sha256(content.encode("utf-8")).hexdigest()

    @staticmethod
    def get_signature_key(sk, date, region, service):
        k_date = VolcSigner.hmac_sha256(sk.encode("utf-8"), date)
        k_region = VolcSigner.hmac_sha256(k_date, region)
        k_service = VolcSigner.hmac_sha256(k_region, service)
        return VolcSigner.hmac_sha256(k_service, "request")

    @staticmethod
    def sign_request(method, url, params, headers, body, ak, sk, region, service):
        # 1. Prepare Date
        t = datetime.datetime.utcnow()
        amz_date = t.strftime('%Y%m%dT%H%M%SZ')
        date_stamp = t.strftime('%Y%m%d')

        # Add x-date to headers if not present
        headers['X-Date'] = amz_date
        
        # 2. Canonical Headers
        # We need to sort headers by name and lowercase them
        canonical_headers = ''
        signed_headers = ''
        
        sorted_keys = sorted(headers.keys())
        for key in sorted_keys:
            val = headers[key]
            canonical_headers += f"{key.lower()}:{val}\n"
            signed_headers += f"{key.lower()};"
        signed_headers = signed_headers.rstrip(';')

        # 3. Canonical Query Params
        canonical_querystring = ''
        sorted_params = sorted(params.keys())
        for key in sorted_params:
            val = params[key]
            # Important: urllib.parse.quote safe chars might differ slightly from AWS spec, 
            # but usually safe='-_.~' is correct for SigV4
            canonical_querystring += f"{quote(key, safe='-_.~')}={quote(str(val), safe='-_.~')}&"
        canonical_querystring = canonical_querystring.rstrip('&')

        # 4. Payload Hash
        payload_hash = VolcSigner.sha256(body)

        # 5. Canonical Request
        path = url if url else "/"
        canonical_request = f"{method}\n{path}\n{canonical_querystring}\n{canonical_headers}\n{signed_headers}\n{payload_hash}"
        
        # 6. String to Sign
        algorithm = 'HMAC-SHA256'
        credential_scope = f"{date_stamp}/{region}/{service}/request"
        string_to_sign = f"{algorithm}\n{amz_date}\n{credential_scope}\n{VolcSigner.sha256(canonical_request)}"

        # 7. Calculate Signature
        signing_key = VolcSigner.get_signature_key(sk, date_stamp, region, service)
        signature = hmac.new(signing_key, string_to_sign.encode('utf-8'), hashlib.sha256).hexdigest()

        # 8. Authorization Header
        authorization_header = f"{algorithm} Credential={ak}/{credential_scope}, SignedHeaders={signed_headers}, Signature={signature}"
        
        # Return headers to add
        return {
            'Authorization': authorization_header,
            'X-Date': amz_date
        }
