import sys
from pathlib import Path

from mcp.server.fastmcp import FastMCP

ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from agents.agent import current_datetime, perform_web_search, weather_lookup
from utils.file_utils import SUPPORTED_EXTENSIONS, parse_local_file
from utils.stock_utils import format_hs_stock_item, get_hs_index_item, get_hs_stock_item, has_juhe_stock_key
from utils.weather_utils import current_cn_datetime, geocode_location, has_amap_key

mcp = FastMCP("ai-agent-tools")


@mcp.tool()
def web_search(query: str) -> str:
    """Search the public web for current information and return filtered results."""
    return perform_web_search(query)


@mcp.tool()
def current_datetime_tool() -> str:
    """Get the current date and time in Asia/Shanghai."""
    return current_datetime.invoke({})


@mcp.tool()
def geocode_location_tool(location: str) -> str:
    """Resolve a Chinese location to a formatted address and adcode."""
    if not has_amap_key():
        return "未配置 AMAP_WEB_API_KEY，无法调用高德地理编码。"
    payload = geocode_location(location)
    return (
        f"查询地点: {location}\n"
        f"标准地址: {payload['formatted_address']}\n"
        f"省份: {payload['province']}\n"
        f"城市: {payload['city']}\n"
        f"区县: {payload['district']}\n"
        f"adcode: {payload['adcode']}\n"
        f"坐标: {payload['location']}\n"
        f"级别: {payload['level']}"
    )


@mcp.tool()
def weather_lookup_tool(location: str, forecast: bool = False) -> str:
    """Get current weather or forecast for a Chinese location using AMap."""
    return weather_lookup.invoke({"location": location, "forecast": forecast})


@mcp.tool()
def hs_index_snapshot(index_type: str) -> str:
    """Get HS market index snapshot. index_type=0 for 上证综合指数, 1 for 深证成份指数."""
    if not has_juhe_stock_key():
        return "未配置 JUHE_STOCK_API_KEY，无法调用聚合数据股票接口。"
    return format_hs_stock_item(get_hs_index_item(index_type))


@mcp.tool()
def hs_stock_snapshot(gid: str) -> str:
    """Get HS stock snapshot by gid like sh601009 or sz000001."""
    if not has_juhe_stock_key():
        return "未配置 JUHE_STOCK_API_KEY，无法调用聚合数据股票接口。"
    return format_hs_stock_item(get_hs_stock_item(gid))


@mcp.tool()
def summarize_file(path: str) -> str:
    """Read a local pdf, txt, markdown, csv, excel, docx, or image file and return extracted content."""
    resolved = Path(path).expanduser().resolve()
    parsed = parse_local_file(resolved)
    lines = [
        f"文件: {resolved}",
        f"类型: {parsed['extension']}",
        f"大小: {parsed['size_bytes']} bytes",
    ]
    if parsed.get("note"):
        lines.append(f"说明: {parsed['note']}")
    if parsed.get("modality") == "image":
        lines.extend(["", "该文件是图片。当前 MCP 工具返回元信息；如需 OCR 或图像理解，请通过主聊天应用上传给多模态模型。"])
    else:
        lines.extend(["", parsed["content"]])
    return "\n".join(lines)


@mcp.tool()
def list_supported_file_types() -> str:
    """List the file types currently supported by the local file parser."""
    return ", ".join(sorted(SUPPORTED_EXTENSIONS))


if __name__ == "__main__":
    mcp.run(transport="stdio")
