import json
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, File, Form, UploadFile
from fastapi.responses import FileResponse, HTMLResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from langchain.messages import AIMessage, AIMessageChunk

from agents.agent import (
    consume_activity_log,
    consume_source_cards,
    delete_thread,
    get_messages,
    list_threads,
    stream_chat,
)
from utils.file_utils import UnsupportedFileTypeError, parse_uploads

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "static"

app = FastAPI(title="AI Agent")
app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")


def extract_renderable_content(content) -> str:
    if isinstance(content, str):
        return content
    if not isinstance(content, list):
        return ""

    parts = []
    for item in content:
        if not isinstance(item, dict):
            continue
        if item.get("type") == "text":
            text = item.get("text", "")
            if text:
                parts.append(text)
    return "".join(parts)


def _sse_event(event_type: str, payload: dict) -> str:
    return f"event: {event_type}\ndata: {json.dumps(payload, ensure_ascii=False)}\n\n"


@app.get("/")
def read_root():
    with open(STATIC_DIR / "index.html", "r", encoding="utf-8") as file:
        return HTMLResponse(content=file.read())


@app.get("/favicon.ico", include_in_schema=False)
def favicon():
    return FileResponse(STATIC_DIR / "gpt.png")


@app.get("/health")
def health_check():
    return {"status": "ok"}


@app.get("/sessions")
def get_sessions():
    try:
        return {"status": "success", "sessions": list_threads()}
    except Exception as exc:
        return {"status": "error", "message": str(exc)}


@app.get("/history/{thread_id}")
def get_history(thread_id: str):
    try:
        return {"status": "success", "messages": get_messages(thread_id)}
    except Exception as exc:
        return {"status": "error", "message": str(exc)}


@app.delete("/history/{thread_id}")
def clear_history(thread_id: str):
    try:
        delete_thread(thread_id)
        return {"status": "success"}
    except Exception as exc:
        return {"status": "error", "message": str(exc)}


@app.post("/chat")
async def chat(
    message: str = Form(""),
    thread_id: str = Form("default"),
    search_enabled: bool = Form(False),
    files: list[UploadFile] | None = File(default=None),
):
    try:
        attachments = parse_uploads(files or [])
    except UnsupportedFileTypeError as exc:
        async def invalid_file_response():
            yield _sse_event("error", {"message": f"[文件类型不支持] {exc}"})

        return StreamingResponse(invalid_file_response(), media_type="text/event-stream; charset=utf-8")
    except Exception as exc:
        async def file_error_response():
            yield _sse_event("error", {"message": f"[文件解析失败] {exc}"})

        return StreamingResponse(file_error_response(), media_type="text/event-stream; charset=utf-8")

    if not message.strip() and not attachments:
        async def empty_response():
            yield _sse_event("error", {"message": "请输入问题，或上传文件/图片后再发送。"})

        return StreamingResponse(empty_response(), media_type="text/event-stream; charset=utf-8")

    def flush_runtime_events():
        payloads = []
        for activity in consume_activity_log():
            payloads.append(_sse_event("activity", activity))
        for source in consume_source_cards():
            payloads.append(_sse_event("source", source))
        return payloads

    def stream_generator():
        try:
            has_output = False
            seen_text = ""

            for chunk, _metadata in stream_chat(
                message=message,
                thread_id=thread_id,
                search_enabled=search_enabled,
                attachments=attachments,
            ):
                for payload in flush_runtime_events():
                    yield payload

                if not isinstance(chunk, (AIMessageChunk, AIMessage)):
                    continue

                text = extract_renderable_content(chunk.content)
                if not text:
                    continue

                if isinstance(chunk, AIMessageChunk):
                    has_output = True
                    seen_text += text
                    yield _sse_event("text", {"delta": text})
                    continue

                if not text.startswith(seen_text):
                    has_output = True
                    seen_text = text
                    yield _sse_event("text", {"delta": text})
                    continue

                delta = text[len(seen_text):]
                if delta:
                    has_output = True
                    seen_text = text
                    yield _sse_event("text", {"delta": delta})

            for payload in flush_runtime_events():
                yield payload

            if not has_output:
                yield _sse_event("text", {"delta": "暂时没有生成结果，请再试一次。"})

            yield _sse_event(
                "done",
                {
                    "ok": True,
                    "attachments": [
                        {
                            "name": attachment["name"],
                            "modality": attachment.get("modality", "text"),
                        }
                        for attachment in attachments
                        if attachment.get("modality") == "text"
                    ],
                },
            )
        except Exception as exc:
            yield _sse_event("error", {"message": f"[服务运行错误或网络超时: {exc}]"})

    return StreamingResponse(stream_generator(), media_type="text/event-stream; charset=utf-8")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="127.0.0.1", port=8000)
