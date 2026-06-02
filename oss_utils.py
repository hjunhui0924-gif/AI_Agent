import base64
import logging
import os
import uuid

import oss2
from dotenv import load_dotenv

load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("oss_utils")


def has_oss_config() -> bool:
    return bool(
        os.getenv("OSS_ACCESS_KEY_ID")
        and os.getenv("OSS_ACCESS_KEY_SECRET")
        and os.getenv("OSS_BUCKET")
    )


def upload_image_bytes(img_bytes: bytes, filename: str, content_type: str | None = None) -> dict:
    oss_access_key = os.getenv("OSS_ACCESS_KEY_ID")
    oss_secret = os.getenv("OSS_ACCESS_KEY_SECRET")
    oss_bucket = os.getenv("OSS_BUCKET")
    oss_endpoint = os.getenv("OSS_ENDPOINT", "oss-cn-beijing.aliyuncs.com")

    if oss_access_key and oss_secret and oss_bucket:
        try:
            auth = oss2.Auth(oss_access_key, oss_secret)
            bucket = oss2.Bucket(auth, oss_endpoint, oss_bucket)
            file_ext = filename.split(".")[-1] if "." in filename else "jpg"
            object_name = f"ai_agent/uploads/{uuid.uuid4().hex}.{file_ext}"
            bucket.put_object(object_name, img_bytes)
            signed_url = bucket.sign_url("GET", object_name, 3600, slash_safe=True)
            logger.info("Image uploaded to OSS: %s", object_name)
            return {
                "storage": "oss",
                "object_key": object_name,
                "url": signed_url,
                "content_type": content_type or "image/jpeg",
            }
        except Exception as exc:
            logger.error("OSS upload failed, fallback to base64: %s", exc)

    img_type = content_type or "image/jpeg"
    img_b64 = base64.b64encode(img_bytes).decode("utf-8")
    return {
        "storage": "inline",
        "object_key": "",
        "url": f"data:{img_type};base64,{img_b64}",
        "content_type": img_type,
    }


def delete_oss_object(object_key: str) -> None:
    if not object_key or not has_oss_config():
        return

    try:
        auth = oss2.Auth(os.getenv("OSS_ACCESS_KEY_ID"), os.getenv("OSS_ACCESS_KEY_SECRET"))
        bucket = oss2.Bucket(auth, os.getenv("OSS_ENDPOINT", "oss-cn-beijing.aliyuncs.com"), os.getenv("OSS_BUCKET"))
        bucket.delete_object(object_key)
        logger.info("Deleted OSS object: %s", object_key)
    except Exception as exc:
        logger.warning("Failed to delete OSS object %s: %s", object_key, exc)
