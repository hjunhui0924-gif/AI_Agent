# AI Agent

一个基于 `FastAPI + LangChain + LangGraph` 的通用 AI 助手项目，提供接近 ChatGPT 的网页工作台体验，支持多轮对话、文件问答、图片理解、可选联网搜索，以及 MCP 工具复用。

## 主要功能

- 通用对话：适合办公问答、学习辅导、内容生成、总结归纳、数据解释等场景。
- 多会话管理：支持新建会话、历史恢复、会话切换与删除。
- 文件问答：支持上传 `pdf / txt / md / csv / docx / doc / xlsx / xls`，自动解析文本并按问题召回相关片段。
- 图片理解：支持上传 `png / jpg / jpeg / webp / gif`，可用于 OCR、截图理解、图像分析。
- 联网搜索：前端可显式开启，后端按需调用搜索与时效校验，不默认强制联网。
- 可见处理过程：在回答过程中展示文件读取、工具调用、联网搜索等可见步骤，不暴露私有推理。
- 来源摘要：当使用搜索时，展示来源卡片并支持查看外部结果列表。
- MCP Server：可将部分能力通过 MCP 暴露给其他支持 MCP 的客户端。

## 界面与体验

- 聊天工作台式前端，支持流式输出。
- 用户消息、AI 回复、来源摘要、过程面板统一在一个对话界面中完成。
- 处理过程区域做了紧凑化展示，步骤过多时支持内部滚动，减少页面占用。

## 技术栈

- Backend: `FastAPI`
- Agent: `LangChain`, `LangGraph`
- Frontend: 原生 `HTML + CSS + JavaScript`
- Search: `Tavily`（可选）
- Weather / Stock: 高德、聚合数据等外部接口（可选）
- File Parsing: `pypdf`, `python-docx`, `openpyxl`, `xlrd`

## 项目结构

```text
AI_Agent/
├─ app.py
├─ agent.py
├─ file_utils.py
├─ weather_utils.py
├─ stock_utils.py
├─ oss_utils.py
├─ requirements.txt
├─ .env.example
├─ static/
│  ├─ index.html
│  ├─ main.js
│  ├─ style.css
│  ├─ gpt.png
│  └─ assistant-mark.png
├─ mcp_server/
│  └─ server.py
├─ resources/
├─ uploads/
└─ skills/
```

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 配置环境变量

复制示例配置：

```bash
cp .env.example .env
```

然后至少配置一组模型参数：

- `OPENAI_API_KEY`
- 或 `LLM_API_KEY`
- 如需自定义兼容地址，可配置 `OPENAI_BASE_URL` 或 `LLM_BASE_URL`

### 3. 启动 Web 应用

```bash
python app.py
```

浏览器访问：

```text
http://127.0.0.1:8000
```

## 环境变量说明

### 必填或常用

- `LLM_PROVIDER`
- `LLM_MODEL`
- `OPENAI_API_KEY`
- `OPENAI_BASE_URL`
- `LLM_API_KEY`
- `LLM_BASE_URL`

### 可选能力

- `TAVILY_API_KEY`
  用于联网搜索。

- `AMAP_WEB_API_KEY`
  用于天气与地理编码能力。

- `JUHE_STOCK_API_KEY`
  用于 A 股指数 / 股票行情查询。

- `LANGSMITH_API_KEY`
- `LANGSMITH_TRACING`
- `LANGSMITH_PROJECT`
  用于链路观测。

## 支持的文件类型

### 文本类

- `.pdf`
- `.txt`
- `.md`
- `.csv`
- `.docx`
- `.doc`
- `.xlsx`
- `.xls`

### 图片类

- `.png`
- `.jpg`
- `.jpeg`
- `.webp`
- `.gif`

## MCP Server

启动本地 MCP Server：

```bash
python mcp_server/server.py
```

当前暴露的主要工具包括：

- `web_search`
- `current_datetime_tool`
- `geocode_location_tool`
- `weather_lookup_tool`
- `hs_index_snapshot`
- `hs_stock_snapshot`
- `summarize_file`
- `list_supported_file_types`

## 适用场景

- 文档问答与资料整理
- 图片 / 截图理解
- 一般工作台式 AI 助手
- 带可见工具过程的演示项目
- 可复用 MCP 工具后端

## 已知说明

- 联网搜索默认关闭，只有前端显式开启后才会触发。
- `.doc` 为兼容性有限格式，推荐优先上传 `.docx`。
- 运行过程中会在本地产生 SQLite 会话数据和缓存文件，不建议提交到仓库。

## 后续可扩展方向

- 接入向量数据库，增强长文档检索能力。
- 为搜索来源增加更强的排序与缓存。
- 增加更完整的测试脚本与自动化回归。
- 增加 Docker 部署文件与生产环境配置。
