import json
import os
import urllib.parse
import urllib.request

from dotenv import load_dotenv

load_dotenv()

JUHE_HS_URL = "https://web.juhe.cn/finance/stock/hs"


def has_juhe_stock_key() -> bool:
    return bool(os.getenv("JUHE_STOCK_API_KEY"))


def _juhe_get(params: dict) -> dict:
    key = os.getenv("JUHE_STOCK_API_KEY", "")
    if not key:
        raise RuntimeError("未配置 JUHE_STOCK_API_KEY")

    query = urllib.parse.urlencode({**params, "key": key})
    url = f"{JUHE_HS_URL}?{query}"
    request = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(request, timeout=20) as response:
        data = response.read().decode("utf-8", errors="replace")
    payload = json.loads(data)
    if str(payload.get("error_code", 0)) != "0" and str(payload.get("resultcode", "")) != "200":
        raise RuntimeError(payload.get("reason", "聚合数据股票接口调用失败"))
    return payload


def get_hs_market_snapshot(gid: str = "", quote_type: str = "", stock_type: str = "a", page: int = 1) -> dict:
    params = {
        "key": os.getenv("JUHE_STOCK_API_KEY", ""),
        "stock": stock_type,
        "page": page,
    }
    if quote_type != "":
        params["type"] = quote_type
    elif gid:
        params["gid"] = gid

    payload = _juhe_get(params)
    result = payload.get("result", [])
    if isinstance(result, dict):
        return {
            "count": 1,
            "page": 1,
            "items": [result],
            "data": result,
            "dapandata": {},
            "gopicture": {},
            "source": "聚合数据 沪深股市接口",
        }

    first = result[0] if result else {}
    return {
        "count": len(result),
        "page": page,
        "items": result,
        "data": first.get("data", {}) if isinstance(first, dict) else {},
        "dapandata": first.get("dapandata", {}) if isinstance(first, dict) else {},
        "gopicture": first.get("gopicture", {}) if isinstance(first, dict) else {},
        "source": "聚合数据 沪深股市接口",
    }


def get_hs_stock_item(gid: str, stock_type: str = "a", page: int = 1) -> dict:
    snapshot = get_hs_market_snapshot(gid=gid, quote_type="", stock_type=stock_type, page=page)
    return snapshot.get("data", {})


def get_hs_index_item(index_type: str) -> dict:
    snapshot = get_hs_market_snapshot(gid="", quote_type=index_type, stock_type="a", page=1)
    return snapshot.get("data", {})


def format_hs_stock_item(item: dict) -> str:
    if not item:
        return "未找到匹配的沪深股票数据。"

    latest_price = item.get("nowPri", "") or item.get("nowpri", "")
    change_value = item.get("nowPic", "") or item.get("increase", "")
    change_pct = item.get("rate", "") or item.get("increPer", "")
    open_price = item.get("todayStartPri", "") or item.get("openPri", "")
    prev_close = item.get("yestodEndPri", "") or item.get("yesPri", "")
    high_price = item.get("todayMax", "") or item.get("highPri", "")
    low_price = item.get("todayMin", "") or item.get("lowpri", "")
    volume = item.get("traNumber", "") or item.get("dealNum", "")
    amount = item.get("traAmount", "") or item.get("dealPri", "")
    update_time = f"{item.get('date', '')} {item.get('time', '')}".strip() or item.get("time", "")

    return "\n".join(
        [
            "沪深股市快照结果:",
            f"名称: {item.get('name', '')}",
            f"代码: {item.get('gid', '')}",
            f"最新价: {latest_price}",
            f"涨跌额: {change_value}",
            f"涨跌幅: {change_pct}%",
            f"今开: {open_price}",
            f"昨收: {prev_close}",
            f"最高: {high_price}",
            f"最低: {low_price}",
            f"成交量: {volume}",
            f"成交额: {amount}",
            f"更新时间: {update_time}",
        ]
    )
