const STORAGE_THREAD_KEY = "ai_agent_current_thread";
const STORAGE_RECENT_COLLAPSED_KEY = "ai_agent_recent_collapsed";
const STORAGE_SEARCH_TOGGLE_KEY = "ai_agent_search_enabled";

let sessionMetas = {};
let currentThreadId = localStorage.getItem(STORAGE_THREAD_KEY) || null;
let recentCollapsed = localStorage.getItem(STORAGE_RECENT_COLLAPSED_KEY) === "1";
let searchEnabled = localStorage.getItem(STORAGE_SEARCH_TOGGLE_KEY) === "1";
let selectedFiles = [];
let activeDrawerSources = [];
let lastRequestPayload = null;
let userScrollingChat = false;
let userScrollTimer = null;

const toggleSidebarBtn = document.getElementById("toggle-sidebar-btn");
const mobileOverlay = document.getElementById("mobile-overlay");
const chatContainer = document.getElementById("chat-container");
const sessionListEl = document.getElementById("session-list");
const messageInput = document.getElementById("message-input");
const fileInput = document.getElementById("file-input");
const fileChipList = document.getElementById("file-chip-list");
const sendButton = document.getElementById("send-button");
const newChatBtn = document.getElementById("new-chat-btn");
const recentToggle = document.getElementById("recent-toggle");
const searchToggle = document.getElementById("search-toggle");
const searchDrawer = document.getElementById("search-drawer");
const searchDrawerOverlay = document.getElementById("search-drawer-overlay");
const searchDrawerBody = document.getElementById("search-drawer-body");
const searchDrawerClose = document.getElementById("search-drawer-close");

marked.setOptions({ breaks: true, gfm: true });

function isMobile() {
    return window.innerWidth <= 860;
}

function updateSidebarState(open) {
    document.body.classList.toggle("sidebar-open", open);
    document.body.classList.toggle("sidebar-collapsed", !open);
}

function saveCurrentThread() {
    localStorage.setItem(STORAGE_THREAD_KEY, currentThreadId || "");
}

function updateSearchToggleState() {
    searchToggle.classList.toggle("active", searchEnabled);
    localStorage.setItem(STORAGE_SEARCH_TOGGLE_KEY, searchEnabled ? "1" : "0");
}

function setSendingState(sending) {
    messageInput.disabled = sending;
    sendButton.disabled = sending;
    searchToggle.disabled = sending;
    sendButton.classList.toggle("is-loading", sending);
}

function autoResizeTextarea() {
    messageInput.style.height = "auto";
    messageInput.style.height = `${Math.min(messageInput.scrollHeight, 180)}px`;
}

function deriveSessionTitle(text, attachments) {
    const cleaned = (text || "").replace(/\s+/g, " ").trim();
    if (cleaned) return cleaned.slice(0, 16);
    if (attachments && attachments.length > 0) return `文件问答: ${attachments[0].name.slice(0, 8)}`;
    return "新会话";
}

function escapeHtml(value) {
    return (value || "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll("\"", "&quot;")
        .replaceAll("'", "&#39;");
}

function compactMarkdown(text) {
    return (text || "")
        .replace(/\r\n/g, "\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
}

function allowUserScrollPriority() {
    userScrollingChat = true;
    if (userScrollTimer) clearTimeout(userScrollTimer);
    userScrollTimer = setTimeout(() => {
        userScrollingChat = false;
    }, 1400);
}

function maybeScrollToBottom(force = false) {
    if (!force && userScrollingChat) return;
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

function renderImageList(imageUrls) {
    if (!imageUrls || imageUrls.length === 0) return "";
    return `<div class="message-image-strip">${imageUrls.map((url) => `<img class="history-image" src="${url}" alt="uploaded image">`).join("")}</div>`;
}

function openSearchDrawer(sources) {
    activeDrawerSources = sources || [];
    searchDrawerBody.innerHTML = activeDrawerSources.map((item, index) => `
        <a class="drawer-result-card" href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer">
            <div class="drawer-result-meta">
                <span class="drawer-result-origin">${escapeHtml(item.title || "搜索结果")}</span>
                ${item.source_date ? `<span class="drawer-result-date">${escapeHtml(item.source_date)}</span>` : ""}
                <span class="drawer-result-index">${index + 1}</span>
            </div>
            <div class="drawer-result-title">${escapeHtml(item.title || item.url)}</div>
            ${item.summary ? `<div class="drawer-result-summary">${escapeHtml(item.summary)}</div>` : ""}
            <div class="drawer-result-url">${escapeHtml(item.url)}</div>
        </a>
    `).join("");
    document.body.classList.add("drawer-open");
    searchDrawer.setAttribute("aria-hidden", "false");
}

function closeSearchDrawer() {
    document.body.classList.remove("drawer-open");
    searchDrawer.setAttribute("aria-hidden", "true");
}

function renderSearchSummary(sources) {
    if (!sources || sources.length === 0) return "";
    return `
        <button class="search-summary-button" type="button" data-open-search-results="1">
            <span class="search-summary-icon">⌕</span>
            <span>搜索到 ${sources.length} 个网页</span>
        </button>
    `;
}

function dedupeSources(sources) {
    const seen = new Set();
    return (sources || []).filter((item) => {
        const key = `${item?.url || ""}__${item?.title || ""}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

function shouldDisplayActivity(item) {
    if (!item) return false;
    const title = String(item.title || "").trim();
    if (!title) return false;
    if (item.stage === "attachment" && title === "未附加文件") return false;
    if (item.stage === "search" && title === "联网搜索未开启") return false;
    return true;
}

function renderAnswerActions() {
    return `
        <div class="answer-actions">
            <button class="answer-action-btn" type="button" data-action="copy" title="复制">
                <svg stroke="currentColor" fill="none" stroke-width="2" viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round" height="18" width="18" aria-hidden="true">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                </svg>
            </button>
            <button class="answer-action-btn" type="button" data-action="regenerate" title="重新生成">
                <svg stroke="currentColor" fill="none" stroke-width="2" viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round" height="18" width="18" aria-hidden="true">
                    <polyline points="23 4 23 10 17 10"></polyline>
                    <polyline points="1 20 1 14 7 14"></polyline>
                    <path d="M3.51 9a9 9 0 0 1 14.13-3.36L23 10"></path>
                    <path d="M20.49 15a9 9 0 0 1-14.13 3.36L1 14"></path>
                </svg>
            </button>
        </div>
    `;
}

function renderUserActions() {
    return `
        <div class="answer-actions user-actions">
            <button class="answer-action-btn" type="button" data-user-action="copy-user" title="复制">
                <svg stroke="currentColor" fill="none" stroke-width="2" viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round" height="18" width="18" aria-hidden="true">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                </svg>
            </button>
            <button class="answer-action-btn" type="button" data-user-action="edit-user" title="修改">
                <svg stroke="currentColor" fill="none" stroke-width="2" viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round" height="18" width="18" aria-hidden="true">
                    <path d="M12 20h9"></path>
                    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"></path>
                </svg>
            </button>
        </div>
    `;
}

function renderFileSources(attachments) {
    const textFiles = (attachments || []).filter((item) => item.modality === "text");
    if (textFiles.length === 0) return "";
    return `<div class="file-source-note">来源文件：${textFiles.map((item) => escapeHtml(item.name)).join("、")}</div>`;
}

function renderEmptyState() {
    chatContainer.innerHTML = `
        <div class="empty-state">
            <div class="empty-card">
                <img src="/static/gpt.png" alt="AI Agent">
                <div class="eyebrow">AI Agent Workspace</div>
                <h2>文件问答、图片理解、联网搜索、活动跟踪</h2>
                <p>上传文件或图片后直接提问，界面会展示顺序步骤、搜索摘要与引用来源。</p>
            </div>
        </div>
    `;
}

function jumpChatToBottom(force = false) {
    maybeScrollToBottom(force);
}

function moveSessionToTop(threadId) {
    if (!threadId || !sessionMetas[threadId]) return;
    const session = sessionMetas[threadId];
    const reordered = { [threadId]: session };
    Object.keys(sessionMetas).forEach((id) => {
        if (id !== threadId) reordered[id] = sessionMetas[id];
    });
    sessionMetas = reordered;
}

function isCurrentSessionEmptyNew() {
    const hasMessages = Boolean(chatContainer.querySelector(".message-wrapper"));
    return Boolean(currentThreadId)
        && sessionMetas[currentThreadId]?.title === "新会话"
        && !hasMessages;
}

function createNewSession() {
    if (isCurrentSessionEmptyNew()) return;
    const newId = `thread_${Math.random().toString(36).slice(2, 10)}`;
    sessionMetas[newId] = { title: "新会话" };
    currentThreadId = newId;
    moveSessionToTop(newId);
    saveCurrentThread();
    renderSessionList();
    renderEmptyState();
    if (isMobile()) updateSidebarState(false);
}

function renderFileChips() {
    fileChipList.innerHTML = "";
    if (selectedFiles.length === 0) {
        fileChipList.classList.remove("show");
        return;
    }
    fileChipList.classList.add("show");
    selectedFiles.forEach((file, index) => {
        const chip = document.createElement("button");
        chip.type = "button";
        chip.className = "file-chip";
        chip.dataset.fileIndex = String(index);
        chip.innerHTML = `
            <span>${escapeHtml(file.name)}</span>
            <span class="chip-close">×</span>
        `;
        fileChipList.appendChild(chip);
    });
}

function syncFileInput() {
    const transfer = new DataTransfer();
    selectedFiles.forEach((file) => transfer.items.add(file));
    fileInput.files = transfer.files;
}

function removeSelectedFile(index) {
    selectedFiles = selectedFiles.filter((_, itemIndex) => itemIndex !== index);
    syncFileInput();
    renderFileChips();
}

function renderAttachmentList(attachments) {
    if (!attachments || attachments.length === 0) return "";
    return `
        <div class="message-attachments">
            ${attachments.map((item) => `<span class="attachment-pill">${escapeHtml(item.name || item)}</span>`).join("")}
        </div>
    `;
}

function renderStepPanel(stepState) {
    if (!stepState) return "";
    const seconds = stepState.startedAt ? Math.max(1, Math.round((Date.now() - stepState.startedAt) / 1000)) : 1;
    const title = stepState.completed ? `已思考（用时 ${seconds} 秒）` : `思考中（已用时 ${seconds} 秒）`;
    return `
        <details class="thinking-panel ${stepState.completed ? "completed" : "running"}" ${stepState.collapsed ? "" : "open"}>
            <summary class="thinking-header">
                <div class="thinking-header-left">
                    <span class="thinking-orbit">◌</span>
                    <span>${title}</span>
                </div>
            </summary>
            <div class="thinking-steps"></div>
        </details>
    `;
}

function buildStepCardHtml(item, index) {
    return `
        <div class="thinking-step-card" style="animation-delay:${index * 45}ms">
            <div class="thinking-step-title">${escapeHtml(item.title)}</div>
            ${item.detail ? `<div class="thinking-step-detail">${escapeHtml(item.detail)}</div>` : ""}
        </div>
    `;
}

function renderSessionList() {
    sessionListEl.innerHTML = "";
    Object.keys(sessionMetas).forEach((id) => {
        const item = document.createElement("div");
        item.className = `session-item ${id === currentThreadId ? "active" : ""}`;
        item.innerHTML = `
            <div class="session-main" data-session-id="${id}">
                <svg stroke="currentColor" fill="none" stroke-width="2" viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round" height="16" width="16" aria-hidden="true">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                </svg>
                <span class="session-title">${escapeHtml(sessionMetas[id].title || "新会话")}</span>
            </div>
            <button class="delete-session-btn" type="button" data-delete-id="${id}" title="删除会话">
                <svg stroke="currentColor" fill="none" stroke-width="2" viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round" height="15" width="15" aria-hidden="true">
                    <polyline points="3 6 5 6 21 6"></polyline>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                </svg>
            </button>
        `;
        sessionListEl.appendChild(item);
    });
    sessionListEl.classList.toggle("hidden", recentCollapsed);
    recentToggle.classList.toggle("collapsed", recentCollapsed);
    localStorage.setItem(STORAGE_RECENT_COLLAPSED_KEY, recentCollapsed ? "1" : "0");
}

function appendMessageUI(role, content, attachments = [], imageUrls = [], isSearching = false, autoScroll = true, sources = [], stepState = null, textSourceAttachments = []) {
    const emptyState = chatContainer.querySelector(".empty-state");
    if (emptyState) emptyState.remove();

    const isBot = role === "bot" || role === "assistant";
    const wrapper = document.createElement("div");
    wrapper.className = `message-wrapper ${isBot ? "bot" : "user"}`;

    const safeContent = typeof content === "string" ? content : String(content ?? "");
    const textHtml = isBot
        ? marked.parse(compactMarkdown(safeContent || "正在思考中..."))
        : `<div class="plain-user-text">${escapeHtml(safeContent || "上传了文件或图片")}</div>`;

    wrapper.innerHTML = `
        <div class="message-content">
            <div class="avatar ${isBot ? "bot-avatar" : "user-avatar"}">${isBot ? "AI" : "U"}</div>
            <div class="message-stack">
                <div class="text">
                ${isSearching && isBot ? '<div class="search-indicator">联网搜索已开启</div>' : ""}
                ${renderAttachmentList(attachments)}
                ${renderImageList(imageUrls)}
                ${isBot ? renderStepPanel(stepState) : ""}
                <div class="assistant-text-block">${textHtml}</div>
                ${isBot && sources.length > 0 ? renderSearchSummary(sources) : ""}
                ${isBot ? renderFileSources(textSourceAttachments) : ""}
                </div>
                <div class="message-footer-actions">
                    ${isBot ? renderAnswerActions() : renderUserActions()}
                </div>
            </div>
        </div>
    `;

    wrapper.__sources = sources;
    wrapper.__assistantText = safeContent;
    wrapper.__lastRequestPayload = lastRequestPayload;
    wrapper.__stepState = stepState;
    wrapper.__userText = !isBot ? safeContent : "";
    chatContainer.appendChild(wrapper);
    if (autoScroll) maybeScrollToBottom(true);
    return wrapper;
}

function createAssistantMessageFrame(searchState) {
    const stepState = {
        activities: [],
        startedAt: Date.now(),
        completed: false,
        collapsed: false,
        lastRenderedCount: 0,
    };
    const sources = [];
    const textSourceAttachments = [];
    const wrapper = appendMessageUI(
        "bot",
        buildStreamingPlaceholder(searchState),
        [],
        [],
        searchState,
        true,
        sources,
        stepState,
        textSourceAttachments
    );
    const textContainer = wrapper.querySelector(".assistant-text-block");
    const stepsContainer = wrapper.querySelector(".thinking-steps");
    return {
        wrapper,
        textContainer,
        stepsContainer,
        stepState,
        sources,
        textSourceAttachments,
        fullText: "",
    };
}

function renderAssistantFrame(frame, searchState) {
    const textRoot = frame.wrapper.querySelector(".text");
    if (!frame.textContainer) {
        frame.textContainer = frame.wrapper.querySelector(".assistant-text-block");
    }
    let thinkingPanel = frame.wrapper.querySelector(".thinking-panel");
    if (!thinkingPanel && frame.stepState && textRoot && frame.textContainer) {
        frame.textContainer.insertAdjacentHTML("beforebegin", renderStepPanel(frame.stepState));
        thinkingPanel = frame.wrapper.querySelector(".thinking-panel");
        frame.stepsContainer = frame.wrapper.querySelector(".thinking-steps");
    }
    if (thinkingPanel) {
        thinkingPanel.classList.toggle("completed", frame.stepState.completed);
        const titleNode = thinkingPanel.querySelector(".thinking-header-left span:last-child");
        const seconds = frame.stepState.startedAt ? Math.max(1, Math.round((Date.now() - frame.stepState.startedAt) / 1000)) : 1;
        if (titleNode) {
            titleNode.textContent = frame.stepState.completed ? `已思考（用时 ${seconds} 秒）` : `思考中（已用时 ${seconds} 秒）`;
        }
        if (frame.stepsContainer && frame.stepState.activities.length > frame.stepState.lastRenderedCount) {
            for (let i = frame.stepState.lastRenderedCount; i < frame.stepState.activities.length; i += 1) {
                frame.stepsContainer.insertAdjacentHTML("beforeend", buildStepCardHtml(frame.stepState.activities[i], i));
            }
            frame.stepState.lastRenderedCount = frame.stepState.activities.length;
        }
    }

    frame.textContainer.innerHTML = marked.parse(compactMarkdown(frame.fullText || buildStreamingPlaceholder(searchState)));

    frame.sources = dedupeSources(frame.sources);
    textRoot.querySelectorAll(".search-summary-button").forEach((node) => node.remove());
    if (frame.sources.length > 0) {
        frame.textContainer.insertAdjacentHTML("afterend", renderSearchSummary(frame.sources));
    }

    textRoot.querySelectorAll(".file-source-note").forEach((node) => node.remove());
    if (frame.textSourceAttachments.length > 0) {
        textRoot.insertAdjacentHTML("beforeend", renderFileSources(frame.textSourceAttachments));
    }

    frame.wrapper.__sources = frame.sources;
    frame.wrapper.__assistantText = frame.fullText;
    frame.wrapper.__lastRequestPayload = lastRequestPayload;
    frame.wrapper.__stepState = frame.stepState;
    maybeScrollToBottom();
}

async function switchSession(id) {
    if (currentThreadId === id) return;
    currentThreadId = id;
    saveCurrentThread();
    renderSessionList();
    await loadAndRenderHistory(id);
    if (isMobile()) updateSidebarState(false);
}

async function deleteSession(id) {
    if (!confirm("确定要删除这个会话的全部记录吗？")) return;
    try {
        await fetch(`/history/${id}`, { method: "DELETE" });
    } catch (error) {
        console.error("删除后端记录失败:", error);
    }

    delete sessionMetas[id];
    if (Object.keys(sessionMetas).length === 0) {
        currentThreadId = null;
        saveCurrentThread();
        createNewSession();
        return;
    }

    if (currentThreadId === id) currentThreadId = Object.keys(sessionMetas)[0];
    saveCurrentThread();
    renderSessionList();
    await loadAndRenderHistory(currentThreadId);
}

async function loadAndRenderHistory(id) {
    chatContainer.innerHTML = "";
    appendMessageUI("bot", "正在加载历史对话中...");
    try {
        const response = await fetch(`/history/${id}`);
        const data = await response.json();
        chatContainer.innerHTML = "";

        if (data.status === "success" && Array.isArray(data.messages) && data.messages.length > 0) {
            data.messages.forEach((msg) => {
                appendMessageUI(
                    msg.role === "user" ? "user" : "bot",
                    msg.content,
                    msg.attachments || [],
                    msg.image_urls || [],
                    Boolean(msg.search_enabled)
                );
            });
            maybeScrollToBottom(true);
        } else {
            renderEmptyState();
        }
    } catch (error) {
        chatContainer.innerHTML = "";
        appendMessageUI("bot", "加载历史对话失败，可能是后端服务未启动。");
        console.error(error);
    }
}

async function initializeSessions() {
    try {
        const response = await fetch("/sessions");
        const data = await response.json();
        sessionMetas = {};

        if (data.status === "success" && Array.isArray(data.sessions)) {
            data.sessions.forEach((session) => {
                if (!session?.thread_id) return;
                sessionMetas[session.thread_id] = { title: session.title || session.thread_id };
            });
        }
    } catch (error) {
        sessionMetas = {};
        console.error("加载会话列表失败:", error);
    }

    const ids = Object.keys(sessionMetas);
    if (ids.length === 0) {
        createNewSession();
        return;
    }

    if (!currentThreadId || !sessionMetas[currentThreadId]) currentThreadId = ids[0];
    saveCurrentThread();
    renderSessionList();
    await loadAndRenderHistory(currentThreadId);
}

function buildStreamingPlaceholder(isSearching) {
    return isSearching
        ? "正在联网搜索并整理结果...\n\n我会先校验结果时效性，再给出结论。"
        : "正在思考并整理答案...\n\n我会先处理上下文，再给出回复。";
}

async function runAssistantResponse(payloadOverride = null, targetWrapper = null) {
    const sourcePayload = payloadOverride || {
        text: messageInput.value.trim(),
        attachments: [...selectedFiles],
        searchEnabled,
    };
    const text = sourcePayload.text;
    const attachments = sourcePayload.attachments;
    const searchState = sourcePayload.searchEnabled;
    if (!text && attachments.length === 0) return;

    lastRequestPayload = {
        text,
        attachments: attachments.slice(),
        searchEnabled: searchState,
    };

    const formData = new FormData();
    formData.append("message", text);
    formData.append("thread_id", currentThreadId);
    formData.append("search_enabled", searchState ? "true" : "false");
    attachments.forEach((file) => formData.append("files", file));

    if (!payloadOverride) {
        appendMessageUI(
            "user",
            text || "请结合我上传的文件或图片回答。",
            attachments.map((file) => ({ name: file.name })),
            [],
            searchState
        );

        messageInput.value = "";
        selectedFiles = [];
        syncFileInput();
        renderFileChips();
        autoResizeTextarea();
    }

    setSendingState(true);

    try {
        moveSessionToTop(currentThreadId);
        renderSessionList();

        let frame;
        if (targetWrapper) {
            frame = {
                wrapper: targetWrapper,
                textContainer: targetWrapper.querySelector(".assistant-text-block"),
                stepsContainer: targetWrapper.querySelector(".thinking-steps"),
                stepState: {
                    activities: [],
                    startedAt: Date.now(),
                    completed: false,
                    collapsed: false,
                    lastRenderedCount: 0,
                },
                sources: [],
                textSourceAttachments: [],
                fullText: "",
            };
            targetWrapper.classList.add("regenerating");
        } else {
            frame = createAssistantMessageFrame(searchState);
        }

        const timer = setInterval(() => renderAssistantFrame(frame, searchState), 220);
        renderAssistantFrame(frame, searchState);

        const response = await fetch("/chat", {
            method: "POST",
            body: formData,
        });

        if (!response.body) throw new Error("响应流为空");

        const reader = response.body.getReader();
        const decoder = new TextDecoder("utf-8");
        let buffer = "";

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const events = buffer.split("\n\n");
            buffer = events.pop() || "";

            for (const rawEvent of events) {
                const lines = rawEvent.split("\n");
                let eventType = "message";
                let data = "";
                for (const line of lines) {
                    if (line.startsWith("event:")) eventType = line.slice(6).trim();
                    if (line.startsWith("data:")) data += line.slice(5).trim();
                }
                if (!data) continue;

                const payload = JSON.parse(data);
                if (eventType === "activity") {
                    if (shouldDisplayActivity(payload)) {
                        frame.stepState.activities.push(payload);
                    }
                } else if (eventType === "source") {
                    frame.sources.push(payload);
                    frame.sources = dedupeSources(frame.sources);
                } else if (eventType === "text") {
                    frame.fullText += payload.delta || "";
                } else if (eventType === "done") {
                    frame.stepState.completed = true;
                    frame.textSourceAttachments.splice(0, frame.textSourceAttachments.length, ...(payload.attachments || []));
                } else if (eventType === "error") {
                    frame.fullText += payload.message || "";
                    frame.stepState.completed = true;
                }
                renderAssistantFrame(frame, searchState);
            }
        }

        frame.stepState.completed = true;
        clearInterval(timer);
        renderAssistantFrame(frame, searchState);
        if (targetWrapper) targetWrapper.classList.remove("regenerating");
    } catch (error) {
        appendMessageUI("bot", "发送失败，请检查网络或确认后端服务是否正常运行。");
        console.error(error);
    } finally {
        setSendingState(false);
        messageInput.focus();
    }
}

async function sendMessage(payloadOverride = null) {
    return runAssistantResponse(payloadOverride, null);
}

toggleSidebarBtn.addEventListener("click", () => {
    updateSidebarState(document.body.classList.contains("sidebar-collapsed"));
});

mobileOverlay.addEventListener("click", () => {
    if (isMobile()) updateSidebarState(false);
});

recentToggle.addEventListener("click", () => {
    recentCollapsed = !recentCollapsed;
    renderSessionList();
});

newChatBtn.addEventListener("click", createNewSession);
searchDrawerClose.addEventListener("click", closeSearchDrawer);
searchDrawerOverlay.addEventListener("click", closeSearchDrawer);

sessionListEl.addEventListener("click", async (event) => {
    const deleteTarget = event.target.closest("[data-delete-id]");
    if (deleteTarget) {
        await deleteSession(deleteTarget.dataset.deleteId);
        return;
    }
    const switchTarget = event.target.closest("[data-session-id]");
    if (switchTarget) {
        await switchSession(switchTarget.dataset.sessionId);
    }
});

chatContainer.addEventListener("click", async (event) => {
    const searchTrigger = event.target.closest("[data-open-search-results]");
    if (searchTrigger) {
        const wrapper = searchTrigger.closest(".message-wrapper");
        if (wrapper) openSearchDrawer(wrapper.__sources || []);
        return;
    }

    const actionButton = event.target.closest("[data-action]");
    if (actionButton) {
        const wrapper = actionButton.closest(".message-wrapper");
        if (!wrapper) return;
        const action = actionButton.dataset.action;

        if (action === "copy") {
            try {
                await navigator.clipboard.writeText(wrapper.__assistantText || "");
                actionButton.classList.add("copied");
                setTimeout(() => actionButton.classList.remove("copied"), 1200);
            } catch (error) {
                console.error(error);
            }
            return;
        }

        if (action === "regenerate") {
            const payload = wrapper.__lastRequestPayload;
            if (!payload) return;
            await runAssistantResponse(payload, wrapper);
        }
        return;
    }

    const userActionButton = event.target.closest("[data-user-action]");
    if (userActionButton) {
        const wrapper = userActionButton.closest(".message-wrapper");
        if (!wrapper) return;
        const action = userActionButton.dataset.userAction;

        if (action === "copy-user") {
            try {
                await navigator.clipboard.writeText(wrapper.__userText || "");
                userActionButton.classList.add("copied");
                setTimeout(() => userActionButton.classList.remove("copied"), 1200);
            } catch (error) {
                console.error(error);
            }
            return;
        }

        if (action === "edit-user") {
            messageInput.value = wrapper.__userText || "";
            autoResizeTextarea();
            messageInput.focus();
            return;
        }
    }
});

chatContainer.addEventListener("toggle", (event) => {
    const panel = event.target.closest(".thinking-panel");
    if (!panel) return;
    const wrapper = panel.closest(".message-wrapper");
    if (!wrapper || !wrapper.__stepState) return;
    wrapper.__stepState.collapsed = !panel.open;
}, true);

chatContainer.addEventListener("wheel", () => {
    allowUserScrollPriority();
}, { passive: true });

chatContainer.addEventListener("touchmove", () => {
    allowUserScrollPriority();
}, { passive: true });

fileInput.addEventListener("change", () => {
    const incoming = [...fileInput.files];
    selectedFiles = [...selectedFiles, ...incoming];
    syncFileInput();
    renderFileChips();
});

fileChipList.addEventListener("click", (event) => {
    const target = event.target.closest("[data-file-index]");
    if (!target) return;
    removeSelectedFile(Number(target.dataset.fileIndex));
});

searchToggle.addEventListener("click", () => {
    searchEnabled = !searchEnabled;
    updateSearchToggleState();
});

messageInput.addEventListener("input", autoResizeTextarea);
messageInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        sendMessage();
    }
});
sendButton.addEventListener("click", () => sendMessage());

window.addEventListener("resize", () => {
    updateSidebarState(!isMobile());
});

updateSidebarState(!isMobile());
updateSearchToggleState();
renderSessionList();
autoResizeTextarea();
initializeSessions();
