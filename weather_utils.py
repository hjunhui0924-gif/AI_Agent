import json
import os
import urllib.parse
import urllib.request
from datetime import datetime
from zoneinfo import ZoneInfo

from dotenv import load_dotenv

load_dotenv()

CN_TZ = ZoneInfo("Asia/Shanghai")
AMAP_BASE = "https://restapi.amap.com"


def current_cn_datetime() -> dict:
    now = datetime.now(CN_TZ)
    return {
        "date": now.strftime("%Y-%m-%d"),
        "time": now.strftime("%H:%M:%S"),
        "datetime": now.strftime("%Y-%m-%d %H:%M:%S"),
        "timezone": "Asia/Shanghai",
        "weekday": now.strftime("%A"),
    }


def has_amap_key() -> bool:
    return bool(os.getenv("AMAP_WEB_API_KEY"))


def _amap_get(path: str, params: dict) -> dict:
    key = os.getenv("AMAP_WEB_API_KEY", "")
    if not key:
        raise RuntimeError("未配置 AMAP_WEB_API_KEY")

    query = urllib.parse.urlencode({**params, "key": key})
    url = f"{AMAP_BASE}{path}?{query}"
    request = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(request, timeout=20) as response:
        data = response.read().decode("utf-8", errors="replace")
    payload = json.loads(data)
    if payload.get("status") != "1":
        raise RuntimeError(payload.get("info", "高德接口调用失败"))
    return payload


def geocode_location(location: str) -> dict:
    direct_adcode_map = {
        "上海": "310000",
        "上海市": "310000",
        "北京": "110000",
        "北京市": "110000",
        "广州": "440100",
        "广州市": "440100",
        "深圳": "440300",
        "深圳市": "440300",
        "杭州": "330100",
        "杭州市": "330100",
    }
    if location in direct_adcode_map:
        return {
            "formatted_address": location,
            "province": "",
            "city": location,
            "district": "",
            "adcode": direct_adcode_map[location],
            "location": "",
            "level": "city",
        }

    payload = _amap_get("/v3/geocode/geo", {"address": location})
    geocodes = payload.get("geocodes") or []
    if not geocodes:
        raise RuntimeError(f"未找到地点: {location}")

    item = geocodes[0]
    return {
        "formatted_address": item.get("formatted_address", location),
        "province": item.get("province", ""),
        "city": item.get("city", ""),
        "district": item.get("district", ""),
        "adcode": item.get("adcode", ""),
        "location": item.get("location", ""),
        "level": item.get("level", ""),
    }


def get_amap_weather(location: str, forecast: bool = False) -> dict:
    geo = geocode_location(location)
    params = {"city": geo["adcode"]}
    if forecast:
        params["extensions"] = "all"
    payload = _amap_get("/v3/weather/weatherInfo", params)

    if forecast:
        forecasts = payload.get("forecasts") or []
        if not forecasts:
            raise RuntimeError("未返回天气预报数据")
        item = forecasts[0]
        return {
            "query_location": location,
            "resolved_location": geo["formatted_address"],
            "province": item.get("province", ""),
            "city": item.get("city", ""),
            "adcode": item.get("adcode", ""),
            "reporttime": item.get("reporttime", ""),
            "casts": item.get("casts", []),
            "source": "高德天气 Web 服务 API",
        }

    lives = payload.get("lives") or []
    if not lives:
        raise RuntimeError("未返回实时天气数据")
    item = lives[0]
    return {
        "query_location": location,
        "resolved_location": geo["formatted_address"],
        "province": item.get("province", ""),
        "city": item.get("city", ""),
        "adcode": item.get("adcode", ""),
        "weather": item.get("weather", ""),
        "temperature": item.get("temperature", ""),
        "winddirection": item.get("winddirection", ""),
        "windpower": item.get("windpower", ""),
        "humidity": item.get("humidity", ""),
        "reporttime": item.get("reporttime", ""),
        "source": "高德天气 Web 服务 API",
    }


def format_weather_text(location: str, forecast: bool = False) -> str:
    payload = get_amap_weather(location, forecast=forecast)

    if forecast:
        lines = [
            f"天气预报地点: {payload['resolved_location']}",
            f"更新时间: {payload['reporttime']}",
            f"来源: {payload['source']}",
            "",
            "未来天气:",
        ]
        for cast in payload.get("casts", [])[:4]:
            lines.append(
                f"- {cast.get('date', '')} 周{cast.get('week', '')}: "
                f"白天 {cast.get('dayweather', '')} {cast.get('daytemp', '')}°C，"
                f"夜间 {cast.get('nightweather', '')} {cast.get('nighttemp', '')}°C，"
                f"风向 {cast.get('daywind', '')}/{cast.get('nightwind', '')}，"
                f"风力 {cast.get('daypower', '')}/{cast.get('nightpower', '')}"
            )
        return "\n".join(lines)

    return "\n".join(
        [
            f"天气地点: {payload['resolved_location']}",
            f"天气: {payload['weather']}",
            f"温度: {payload['temperature']}°C",
            f"湿度: {payload['humidity']}",
            f"风向: {payload['winddirection']}",
            f"风力: {payload['windpower']}级",
            f"更新时间: {payload['reporttime']}",
            f"来源: {payload['source']}",
        ]
    )
