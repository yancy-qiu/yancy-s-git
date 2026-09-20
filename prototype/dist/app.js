const STORAGE_KEY = "qingji.prototype.records.v1";
const FEEDBACK_KEY = "qingji.prototype.feedback.v1";
const SETTINGS_KEY = "qingji.prototype.settings.v1";
const LEGACY_AI_KEY_SESSION_KEY = "qingji.prototype.ai-key.v1";
const AI_KEY_SESSION_PREFIX = "qingji.prototype.ai-key.v2.";
const DEFAULT_AI_ENDPOINT = "https://api.openai.com/v1/chat/completions";

const aiProviders = {
  openai: {
    name: "OpenAI",
    protocol: "openai",
    endpoint: DEFAULT_AI_ENDPOINT,
    defaultModel: "",
    modelOptions: [],
    modelPlaceholder: "填写 OpenAI 模型名称",
    keyPlaceholder: "sk-…",
    note: "OpenAI 使用 Chat Completions 接口。API Key 仅保存在当前标签页。",
  },
  anthropic: {
    name: "Claude / Anthropic",
    protocol: "anthropic",
    endpoint: "https://api.anthropic.com/v1/messages",
    defaultModel: "",
    modelOptions: [],
    modelPlaceholder: "填写 Claude 模型名称",
    keyPlaceholder: "sk-ant-…",
    note: "这里接入的是 Claude 的 Anthropic Messages API，适用于拥有 Anthropic API Key 的 Claude Code 用户。",
  },
  deepseek: {
    name: "DeepSeek",
    protocol: "openai",
    endpoint: "https://api.deepseek.com/chat/completions",
    defaultModel: "deepseek-flash",
    modelOptions: ["deepseek-flash", "deepseek-v4-pro"],
    modelPlaceholder: "推荐使用 deepseek-flash",
    keyPlaceholder: "填写 DeepSeek API Key",
    note: "DeepSeek 使用兼容 Chat Completions 的请求格式；请填写控制台中可用的模型名称。",
  },
  zhipu: {
    name: "智谱 GLM",
    protocol: "openai",
    endpoint: "https://open.bigmodel.cn/api/paas/v4/chat/completions",
    defaultModel: "",
    modelOptions: [],
    modelPlaceholder: "填写 GLM 模型名称",
    keyPlaceholder: "填写智谱 API Key",
    note: "智谱 GLM 使用兼容 Chat Completions 的请求格式；请填写开放平台中的模型名称。",
  },
  custom: {
    name: "自定义接口",
    protocol: "openai",
    endpoint: "",
    defaultModel: "",
    modelOptions: [],
    modelPlaceholder: "填写接口支持的模型名称",
    keyPlaceholder: "填写 API Key",
    note: "自定义服务需兼容 OpenAI Chat Completions 的请求与返回结构。",
  },
};

const typeNames = { auto: "自动", task: "任务", meeting: "会议", progress: "进展", need: "需求" };
const priorityNames = { high: "重要", normal: "普通", low: "稍后" };
const localISODate = (date = new Date()) => {
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
};
const addDays = (days) => { const date = new Date(); date.setDate(date.getDate() + days); return localISODate(date); };
const todayISO = localISODate();
const sampleRecords = [
  { id: "sample-task", title: "整理轻记第一版的核心流程", content: "把快速记录、AI 整理和桌面小组件串成一条可测试的体验。", type: "task", time: "09:24", dueDate: todayISO, dueTime: "17:00", priority: "high", reminder: true, completed: false, organized: true, points: ["先完成浏览器交互原型", "收集 5 位用户的真实反馈", "再确认 Mac 原生版范围"] },
  { id: "sample-meeting", title: "和设计伙伴同步原型方向", content: "重点观察用户是否能立即理解输入框、AI 整理和桌面小组件之间的关系。", type: "meeting", time: "11:10", dueDate: addDays(1), dueTime: "10:30", priority: "normal", reminder: true, completed: false, organized: true, points: ["减少说明文字", "记录关键犹豫点", "测试结束后统一复盘"] },
  { id: "sample-progress", title: "完成 Mac 小组件体验草图", content: "小组件优先展示最近三条记录，并支持直接完成任务和快速新增。", type: "progress", time: "14:32", dueDate: "", dueTime: "", priority: "normal", reminder: false, completed: false, organized: false, points: [] },
];

const clone = (value) => JSON.parse(JSON.stringify(value));
const loadRecords = () => {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    const records = Array.isArray(saved) ? saved : clone(sampleRecords);
    return records.map((record) => {
      const sample = sampleRecords.find((item) => item.id === record.id);
      const migrated = sample && !Object.hasOwn(record, "dueDate") ? { ...sample, ...record } : record;
      return { dueDate: "", dueTime: "", priority: "normal", reminder: false, pinned: false, summary: "", clarification: "", ...migrated };
    });
  } catch {
    return clone(sampleRecords);
  }
};

const loadSettings = () => {
  const defaults = { theme: "system", privateWidget: false, aiProvider: "openai", aiProfiles: {} };
  try {
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}");
    const inferredProvider = saved.aiProvider || (saved.aiEndpoint && saved.aiEndpoint !== DEFAULT_AI_ENDPOINT ? "custom" : "openai");
    const profiles = { ...(saved.aiProfiles || {}) };
    if (!profiles[inferredProvider]) {
      profiles[inferredProvider] = {
        endpoint: saved.aiEndpoint || aiProviders[inferredProvider]?.endpoint || "",
        model: saved.aiModel || "",
      };
    }
    if (profiles.deepseek) {
      const deprecatedModels = ["deepseek-chat", "deepseek-reasoner", "deepseek-v4-flash"];
      if (!profiles.deepseek.model || deprecatedModels.includes(profiles.deepseek.model)) profiles.deepseek.model = "deepseek-flash";
    }
    return { theme: saved.theme || defaults.theme, privateWidget: Boolean(saved.privateWidget), aiProvider: aiProviders[inferredProvider] ? inferredProvider : "custom", aiProfiles: profiles };
  } catch { return defaults; }
};
const state = {
  records: loadRecords(),
  selectedId: null,
  filter: "today",
  rating: 0,
  deletedRecord: null,
  settings: loadSettings(),
  aiErrors: {},
  chatRecordId: null,
  chatBusy: false,
  chatMessages: [{ role: "assistant", content: "告诉我你想完成什么。我可以直接创建任务，也可以引用现有任务后帮你改标题、时间、优先级和下一步。" }],
};
const legacySessionApiKey = sessionStorage.getItem(LEGACY_AI_KEY_SESSION_KEY);
if (legacySessionApiKey && !sessionStorage.getItem(AI_KEY_SESSION_PREFIX + state.settings.aiProvider)) {
  sessionStorage.setItem(AI_KEY_SESSION_PREFIX + state.settings.aiProvider, legacySessionApiKey);
}
sessionStorage.removeItem(LEGACY_AI_KEY_SESSION_KEY);
const $ = (selector) => document.querySelector(selector);
const recordsElement = $("#records");
const emptyState = $("#empty-state");
const detailContent = $("#detail-content");
const input = $("#capture-input");
const form = $("#capture-form");
const chatMessagesElement = $("#chat-messages");
const chatTaskPicker = $("#chat-task-picker");
const toast = $("#toast");
const toastMessage = $("#toast-message");
const toastAction = $("#toast-action");

const saveRecords = () => localStorage.setItem(STORAGE_KEY, JSON.stringify(state.records));
const pendingClarifications = state.records.filter((record) => typeof record.clarification === "string" && record.clarification.trim());
if (pendingClarifications.length) {
  state.chatRecordId = pendingClarifications[0].id;
  state.chatMessages = pendingClarifications.map((record) => ({
    role: "assistant",
    content: "关于“" + record.title + "”：" + record.clarification.trim(),
    result: "需要确认",
  }));
  state.records.forEach((record) => { record.clarification = ""; });
  saveRecords();
}
const getRecord = (id) => state.records.find((record) => record.id === id);
const makeId = () => globalThis.crypto?.randomUUID?.() || "record-" + Date.now();
const nowTime = () => new Intl.DateTimeFormat("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date());
function getAIConfig(provider = state.settings.aiProvider) {
  const providerDefinition = aiProviders[provider] || aiProviders.custom;
  const profile = state.settings.aiProfiles[provider] || {};
  return { provider, ...providerDefinition, endpoint: profile.endpoint ?? providerDefinition.endpoint, model: profile.model || providerDefinition.defaultModel || "" };
}
const getApiKey = (provider = state.settings.aiProvider) => sessionStorage.getItem(AI_KEY_SESSION_PREFIX + provider) || "";
const hasAIConfiguration = () => {
  const config = getAIConfig();
  return Boolean(config.endpoint?.trim() && config.model?.trim() && getApiKey());
};

function announce(message, action = null) {
  toastMessage.textContent = message;
  toastAction.hidden = !action;
  toastAction.onclick = action || null;
  toast.classList.add("show");
  window.clearTimeout(announce.timer);
  announce.timer = window.setTimeout(() => toast.classList.remove("show"), action ? 6000 : 1800);
}

function inferType(text) {
  if (/会议|同步|讨论|沟通/.test(text)) return "meeting";
  if (/进展|完成|上线|发布/.test(text)) return "progress";
  if (/需求|用户|希望|建议/.test(text)) return "need";
  return "task";
}

function filteredRecords() {
  if (state.filter === "completed") return state.records.filter((record) => record.completed);
  if (state.filter === "unorganized") return state.records.filter((record) => !record.organized && !record.completed);
  if (state.filter === "inbox") return state.records.filter((record) => !record.dueDate && !record.completed);
  if (state.filter === "planned") return state.records.filter((record) => record.dueDate && record.dueDate > todayISO && !record.completed);
  if (state.filter === "all") return state.records;
  return state.records.filter((record) => !record.completed && record.dueDate && record.dueDate <= todayISO);
}

function setFilter(filter) {
  state.filter = filter;
  $("#mobile-filter").value = filter;
  document.querySelectorAll(".nav-item").forEach((nav) => nav.classList.toggle("active", nav.dataset.filter === filter));
  const labels = {
    today: ["今天要记什么？", "最近记录"],
    inbox: ["先收下来，稍后再安排", "收集箱"],
    planned: ["接下来要做什么？", "计划"],
    unorganized: ["把零散想法变清楚", "待整理"],
    all: ["所有记录都在这里", "全部记录"],
    completed: ["做完的事，也值得看见", "已完成"],
  };
  $("#view-title").textContent = labels[filter][0];
  $("#list-heading").textContent = labels[filter][1];
}

function updateCounts() {
  $("#today-count").textContent = state.records.filter((record) => !record.completed && record.dueDate && record.dueDate <= todayISO).length;
  $("#inbox-count").textContent = state.records.filter((record) => !record.dueDate && !record.completed).length;
  $("#planned-count").textContent = state.records.filter((record) => record.dueDate && record.dueDate > todayISO && !record.completed).length;
  $("#unorganized-count").textContent = state.records.filter((record) => !record.organized && !record.completed).length;
  $("#all-count").textContent = state.records.length;
  $("#completed-count").textContent = state.records.filter((record) => record.completed).length;
}

function formatSchedule(record) {
  if (!record.dueDate) return "收集箱";
  const label = record.dueDate === todayISO ? "今天" : record.dueDate === addDays(1) ? "明天" : record.dueDate.slice(5).replace("-", "月") + "日";
  return label + (record.dueTime ? " " + record.dueTime : "");
}

function setChatContext(recordId, announceChange = true) {
  const record = getRecord(recordId);
  const nextRecordId = record?.id || null;
  if (nextRecordId !== state.chatRecordId) {
    state.chatMessages = [{
      role: "assistant",
      content: record
        ? "已引用“" + record.title + "”。告诉我你想怎么修改，我会直接更新这条任务。"
        : "已开始新任务对话。告诉我你想完成什么，我会帮你创建并安排好。",
    }];
  }
  state.chatRecordId = nextRecordId;
  if (record) state.selectedId = record.id;
  renderChat();
  renderRecords();
  renderDetail();
  if (announceChange) announce(record ? "已引用任务，可以直接告诉 AI 如何修改" : "已切换为新任务对话");
  input.focus();
}

function renderChat() {
  const currentRecord = getRecord(state.chatRecordId);
  const currentPickerValue = currentRecord?.id || "";
  chatTaskPicker.replaceChildren();
  const newTaskOption = document.createElement("option");
  newTaskOption.value = "";
  newTaskOption.textContent = "新任务";
  chatTaskPicker.append(newTaskOption);
  state.records.forEach((record) => {
    const option = document.createElement("option");
    option.value = record.id;
    option.textContent = record.title;
    chatTaskPicker.append(option);
  });
  chatTaskPicker.value = currentPickerValue;

  const context = $("#task-context");
  context.hidden = !currentRecord;
  if (currentRecord) {
    $("#task-context-title").textContent = currentRecord.title;
    $("#copilot-subtitle").textContent = "告诉 AI 如何调整这条任务";
    input.placeholder = "例如：改到周五下午 4 点，并设为重要……";
  } else {
    $("#copilot-subtitle").textContent = "描述目标，AI 会创建并整理任务";
    input.placeholder = "例如：明天下午 3 点提醒我提交周报……";
  }

  chatMessagesElement.replaceChildren();
  state.chatMessages.forEach((message) => {
    const bubble = document.createElement("div");
    bubble.className = "chat-message " + message.role + (message.pending ? " pending" : "");
    bubble.textContent = message.content;
    if (message.result) {
      const result = document.createElement("span");
      result.className = "message-result";
      result.textContent = message.result;
      bubble.append(result);
    }
    chatMessagesElement.append(bubble);
  });
  chatMessagesElement.scrollTop = chatMessagesElement.scrollHeight;

  const suggestions = currentRecord
    ? ["改到明天下午 3 点", "设为重要并开启提醒", "把下一步拆得更清楚"]
    : ["明天下午提醒我提交周报", "记录下周产品讨论会", "帮我规划今天最重要的事"];
  const suggestionContainer = $("#chat-suggestions");
  suggestionContainer.replaceChildren();
  suggestions.forEach((label) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "chat-suggestion";
    button.textContent = label;
    button.addEventListener("click", () => { input.value = label; input.focus(); });
    suggestionContainer.append(button);
  });
  $("#chat-send").disabled = state.chatBusy;
  $("#composer-hint").textContent = state.chatBusy ? "AI 正在理解并更新任务…" : currentRecord ? "本次修改只作用于引用的任务" : "AI 会自动提取类型、时间和优先级";
}

function addChatMessage(role, content, result = "") {
  state.chatMessages.push({ role, content, result });
  if (state.chatMessages.length > 12) state.chatMessages.splice(1, state.chatMessages.length - 12);
}

function renderRecords() {
  const visible = filteredRecords();
  recordsElement.replaceChildren();
  $("#visible-count").textContent = visible.length + " 条";
  emptyState.hidden = visible.length > 0;
  recordsElement.hidden = visible.length === 0;

  visible.forEach((record) => {
    const card = document.createElement("article");
    card.className = "record-card" + (record.completed ? " completed" : "") + (record.id === state.selectedId ? " selected" : "");
    const select = document.createElement("button");
    select.type = "button";
    select.className = "record-select";
    select.addEventListener("click", () => { state.selectedId = record.id; $("#detail-panel").classList.add("active"); render(); });
    const type = document.createElement("span");
    type.className = "record-type " + record.type;
    type.textContent = typeNames[record.type] || "记录";
    const title = document.createElement("strong");
    title.textContent = record.title;
    const content = document.createElement("p");
    content.textContent = record.content;
    const meta = document.createElement("span");
    meta.className = "record-meta";
    const overdue = record.dueDate && record.dueDate < todayISO && !record.completed;
    meta.textContent = (overdue ? "已逾期 · " : "") + formatSchedule(record) + " · " + (record.organized ? "AI 已整理" : "待整理") + (record.priority === "high" ? " · 重要" : "");
    if (overdue) meta.classList.add("overdue");
    select.append(type, title, content, meta);
    const check = document.createElement("button");
    check.type = "button";
    check.className = "check-button";
    check.setAttribute("aria-label", record.completed ? "恢复记录" : "完成记录");
    check.textContent = "✓";
    check.addEventListener("click", () => {
      record.completed = !record.completed;
      saveRecords();
      announce(record.completed ? "已完成" : "已恢复");
      render();
    });
    const collaborate = document.createElement("button");
    collaborate.type = "button";
    collaborate.className = "record-ai-button";
    collaborate.setAttribute("aria-label", "引用“" + record.title + "”与 AI 协作");
    collaborate.title = "与 AI 协作";
    collaborate.textContent = "✦";
    collaborate.addEventListener("click", () => setChatContext(record.id));
    const cardActions = document.createElement("div");
    cardActions.className = "record-card-actions";
    cardActions.append(collaborate, check);
    card.append(select, cardActions);
    recordsElement.append(card);
  });
}

function renderDetail() {
  const visible = filteredRecords();
  const selected = getRecord(state.selectedId);
  const record = selected && visible.some((item) => item.id === selected.id) ? selected : visible[0];
  if (!record) {
    detailContent.innerHTML = '<div class="detail-empty"><p>选择一条记录查看详情。</p></div>';
    return;
  }
  state.selectedId = record.id;
  detailContent.replaceChildren();
  const orb = document.createElement("div");
  orb.className = "ai-orb";
  orb.textContent = record.organized ? "✦" : "…";
  const heading = document.createElement("h2");
  heading.textContent = record.title;
  detailContent.append(orb, heading);
  const metadata = document.createElement("div");
  metadata.className = "detail-metadata";
  [typeNames[record.type], formatSchedule(record), priorityNames[record.priority], record.reminder ? "提醒已开启" : "无提醒"].forEach((value) => {
    const chip = document.createElement("span");
    chip.textContent = value;
    metadata.append(chip);
  });
  detailContent.append(metadata);

  if (record.organized) {
    const summary = document.createElement("section");
    summary.className = "result-block";
    const summaryLabel = document.createElement("label");
    summaryLabel.textContent = "AI 摘要";
    const summaryText = document.createElement("p");
    summaryText.textContent = record.summary || record.content;
    summary.append(summaryLabel, summaryText);
    const points = document.createElement("section");
    points.className = "result-block";
    const pointsLabel = document.createElement("label");
    pointsLabel.textContent = "下一步";
    const list = document.createElement("ul");
    (record.points?.length ? record.points : ["确认下一步行动"]).forEach((point) => {
      const item = document.createElement("li");
      item.textContent = point;
      list.append(item);
    });
    points.append(pointsLabel, list);
    detailContent.append(summary, points);
  } else {
    const block = document.createElement("section");
    block.className = "result-block";
    const label = document.createElement("label");
    label.textContent = "原始记录";
    const text = document.createElement("p");
    text.textContent = record.content;
    const organize = document.createElement("button");
    organize.type = "button";
    organize.className = "primary-button full-width organize-button";
    organize.textContent = "用 AI 整理";
    organize.addEventListener("click", () => organizeRecord(record, organize));
    block.append(label, text, organize);
    if (state.aiErrors[record.id]) {
      const error = document.createElement("p");
      error.className = "connection-status error";
      error.textContent = state.aiErrors[record.id];
      block.append(error);
    }
    detailContent.append(block);
  }

  const actions = document.createElement("div");
  actions.className = "detail-actions";
  const collaborate = document.createElement("button");
  collaborate.type = "button";
  collaborate.className = "primary-button detail-collaborate";
  collaborate.textContent = "✦ 与 AI 协作";
  collaborate.addEventListener("click", () => {
    setChatContext(record.id);
    $(".content").scrollTo({ top: 0, behavior: "smooth" });
  });
  const edit = document.createElement("button");
  edit.type = "button";
  edit.className = "secondary-button";
  edit.textContent = "编辑";
  edit.addEventListener("click", () => renderEditor(record));
  const complete = document.createElement("button");
  complete.type = "button";
  complete.className = "secondary-button";
  complete.textContent = record.completed ? "恢复" : "完成";
  complete.addEventListener("click", () => { record.completed = !record.completed; saveRecords(); render(); });
  const tomorrow = document.createElement("button");
  tomorrow.type = "button";
  tomorrow.className = "secondary-button";
  tomorrow.textContent = "延后到明天";
  tomorrow.addEventListener("click", () => { record.dueDate = addDays(1); saveRecords(); announce("已延后到明天"); render(); });
  const remove = document.createElement("button");
  remove.type = "button";
  remove.className = "danger-button";
  remove.textContent = "删除";
  remove.addEventListener("click", () => deleteRecord(record));
  actions.append(collaborate, edit, complete, tomorrow, remove);
  detailContent.append(actions);
}

function renderEditor(record) {
  detailContent.replaceChildren();
  const editor = document.createElement("form");
  editor.className = "detail-editor";
  const titleLabel = document.createElement("label");
  titleLabel.className = "field-label";
  titleLabel.textContent = "标题";
  const titleInput = document.createElement("input");
  titleInput.value = record.title;
  const contentLabel = document.createElement("label");
  contentLabel.className = "field-label";
  contentLabel.textContent = "内容";
  const contentInput = document.createElement("textarea");
  contentInput.rows = 7;
  contentInput.value = record.content;
  const fields = document.createElement("div");
  fields.className = "editor-grid";
  const typeField = buildSelectField("类型", "edit-type", typeNames, record.type);
  const priorityField = buildSelectField("优先级", "edit-priority", priorityNames, record.priority);
  const dateField = buildInputField("日期", "edit-date", "date", record.dueDate);
  const timeField = buildInputField("时间", "edit-time", "time", record.dueTime);
  fields.append(typeField.wrapper, priorityField.wrapper, dateField.wrapper, timeField.wrapper);
  const reminderLabel = document.createElement("label");
  reminderLabel.className = "editor-check";
  const reminderInput = document.createElement("input");
  reminderInput.type = "checkbox";
  reminderInput.checked = record.reminder;
  reminderLabel.append(reminderInput, document.createTextNode(" 到时提醒"));
  const save = document.createElement("button");
  save.type = "submit";
  save.className = "primary-button full-width";
  save.textContent = "保存修改";
  editor.append(titleLabel, titleInput, contentLabel, contentInput, fields, reminderLabel, save);
  editor.addEventListener("submit", (event) => {
    event.preventDefault();
    record.title = titleInput.value.trim() || record.title;
    record.content = contentInput.value.trim() || record.content;
    record.type = typeField.input.value;
    record.priority = priorityField.input.value;
    record.dueDate = dateField.input.value;
    record.dueTime = dateField.input.value ? timeField.input.value : "";
    record.reminder = Boolean(dateField.input.value && reminderInput.checked);
    saveRecords();
    announce("修改已保存");
    render();
  });
  detailContent.append(editor);
  titleInput.focus();
}

function buildInputField(labelText, id, type, value) {
  const wrapper = document.createElement("label");
  wrapper.className = "field-label";
  wrapper.textContent = labelText;
  const input = document.createElement("input");
  input.id = id;
  input.type = type;
  input.value = value || "";
  wrapper.append(input);
  return { wrapper, input };
}

function buildSelectField(labelText, id, options, value) {
  const wrapper = document.createElement("label");
  wrapper.className = "field-label";
  wrapper.textContent = labelText;
  const input = document.createElement("select");
  input.id = id;
  Object.entries(options).forEach(([optionValue, label]) => {
    if (optionValue === "auto") return;
    const option = document.createElement("option");
    option.value = optionValue;
    option.textContent = label;
    option.selected = optionValue === value;
    input.append(option);
  });
  wrapper.append(input);
  return { wrapper, input };
}

async function organizeRecord(record, button) {
  if (!hasAIConfiguration()) {
    hydrateAISettings();
    openDialog("settings-dialog");
    setConnectionStatus("请先填写 API 地址、模型名称和 API Key。", "error");
    $("#ai-endpoint").focus();
    return;
  }
  button.disabled = true;
  button.textContent = "AI 正在整理…";
  delete state.aiErrors[record.id];
  try {
    const result = await requestAIOrganization(record);
    const clarification = applyAIOrganization(record, result);
    if (clarification) {
      setChatContext(record.id, false);
      addChatMessage("assistant", clarification, "需要确认");
    }
    saveRecords();
    setFilter(!record.dueDate ? "inbox" : record.dueDate > todayISO ? "planned" : "today");
    announce("AI 整理完成");
    render();
  } catch (error) {
    state.aiErrors[record.id] = friendlyAIError(error);
    announce("整理失败，原始记录已保留");
    renderDetail();
  }
}

function validatedAIEndpoint(value) {
  let url;
  try { url = new URL(value); }
  catch { throw new Error("INVALID_ENDPOINT"); }
  const localHost = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (url.protocol !== "https:" && !(url.protocol === "http:" && localHost)) throw new Error("INSECURE_ENDPOINT");
  return url.toString();
}

async function callModel(messages, signal, maxTokens = 1024) {
  const config = getAIConfig();
  const endpoint = validatedAIEndpoint(config.endpoint);
  const apiKey = getApiKey();
  if (!config.model.trim()) throw new Error("MISSING_MODEL");
  if (!apiKey) throw new Error("MISSING_KEY");
  const headers = { "Content-Type": "application/json" };
  let requestBody;
  if (config.protocol === "anthropic") {
    headers["x-api-key"] = apiKey;
    headers["anthropic-version"] = "2023-06-01";
    headers["anthropic-dangerous-direct-browser-access"] = "true";
    const system = messages.filter((message) => message.role === "system").map((message) => message.content).join("\n");
    requestBody = {
      model: config.model.trim(),
      max_tokens: maxTokens,
      system,
      messages: messages.filter((message) => message.role !== "system"),
    };
  } else {
    headers.Authorization = "Bearer " + apiKey;
    requestBody = { model: config.model.trim(), messages };
  }
  const response = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify(requestBody),
    signal,
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error("API_ERROR");
    error.httpStatus = response.status;
    error.provider = config.provider;
    error.providerMessage = sanitizeProviderError(body?.error?.message || body?.message || body?.error?.msg || "", apiKey);
    throw error;
  }
  const content = config.protocol === "anthropic"
    ? body?.content?.filter((item) => item?.type === "text").map((item) => item.text).join("")
    : body?.choices?.[0]?.message?.content;
  if (typeof content === "string" && content.trim()) return content.trim();
  if (Array.isArray(content)) {
    const combined = content.map((item) => typeof item === "string" ? item : item?.text || "").join("").trim();
    if (combined) return combined;
  }
  throw new Error("INVALID_RESPONSE");
}

function sanitizeProviderError(value, apiKey) {
  if (typeof value !== "string") return "";
  return value
    .replaceAll(apiKey, "••••")
    .replace(/Bearer\s+\S+/gi, "Bearer ••••")
    .replace(/sk-[A-Za-z0-9_-]+/g, "sk-••••")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 220);
}

async function withAITimeout(request, milliseconds = 30000) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), milliseconds);
  try { return await request(controller.signal); }
  finally { window.clearTimeout(timeout); }
}

function parseJSONObject(text) {
  const normalized = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  const start = normalized.indexOf("{");
  const end = normalized.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("INVALID_JSON");
  try { return JSON.parse(normalized.slice(start, end + 1)); }
  catch { throw new Error("INVALID_JSON"); }
}

function isValidISODate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) return false;
  const date = new Date(value + "T00:00:00");
  return !Number.isNaN(date.getTime()) && localISODate(date) === value;
}

async function requestAIOrganization(record) {
  const current = new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    dateStyle: "full",
    timeStyle: "short",
    hour12: false,
  }).format(new Date());
  const systemPrompt = [
    "你是轻记中的任务整理助手。根据用户的原始记录提取结构化信息。",
    "当前时间（Asia/Shanghai）：" + current + "。",
    "只返回一个 JSON 对象，不要 Markdown，不要补充说明。",
    "字段必须为：title（精炼标题）、category（task/meeting/progress/need）、summary（不添加事实的简短摘要）、actionItems（最多3条可执行事项）、dueDate（YYYY-MM-DD或null）、dueTime（HH:mm或null）、priority（high/normal/low）、reminder（布尔值）、clarification（信息含糊时的一句确认问题，否则空字符串）。",
    "不要编造日期、时间、负责人或事实。相对日期按当前时间计算；无法确定时返回 null 并写入 clarification。",
  ].join("\n");
  const userPrompt = [
    "原始标题：" + record.title,
    "原始内容：" + record.content,
    "当前日期：" + (record.dueDate || "未设置"),
    "当前时间：" + (record.dueTime || "未设置"),
    "当前优先级：" + record.priority,
  ].join("\n");
  const content = await withAITimeout((signal) => callModel([
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ], signal, 1024));
  return parseJSONObject(content);
}

function applyTaskPayload(record, result, allowScheduleClear = false) {
  const validTypes = ["task", "meeting", "progress", "need"];
  const validPriorities = ["high", "normal", "low"];
  const title = typeof result.title === "string" ? result.title.trim().slice(0, 80) : "";
  const body = typeof result.content === "string" ? result.content.trim().slice(0, 2000) : "";
  const summary = typeof result.summary === "string" ? result.summary.trim().slice(0, 500) : "";
  const clarification = typeof result.clarification === "string" ? result.clarification.trim().slice(0, 180) : "";
  const dueDate = typeof result.dueDate === "string" && isValidISODate(result.dueDate) ? result.dueDate : "";
  const dueTime = dueDate && typeof result.dueTime === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(result.dueTime) ? result.dueTime : "";
  const points = Array.isArray(result.actionItems) ? result.actionItems.filter((item) => typeof item === "string" && item.trim()).slice(0, 3).map((item) => item.trim().slice(0, 160)) : [];
  if (title) record.title = title;
  if (body) record.content = body;
  if (validTypes.includes(result.category)) record.type = result.category;
  if (validPriorities.includes(result.priority)) record.priority = result.priority;
  if (summary || Object.hasOwn(result, "summary")) record.summary = summary || record.content;
  if (Array.isArray(result.actionItems)) record.points = points;
  if (dueDate) {
    record.dueDate = dueDate;
    record.dueTime = dueTime;
    record.reminder = Boolean(result.reminder);
  } else if (allowScheduleClear && Object.hasOwn(result, "dueDate") && (result.dueDate === null || result.dueDate === "")) {
    record.dueDate = "";
    record.dueTime = "";
    record.reminder = false;
  }
  record.clarification = "";
  if (typeof result.completed === "boolean") record.completed = result.completed;
  record.organized = true;
  return clarification;
}

function applyAIOrganization(record, result) {
  return applyTaskPayload(record, result);
}

async function requestAITaskCollaboration(userMessage, referencedRecord) {
  const current = new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    dateStyle: "full",
    timeStyle: "short",
    hour12: false,
  }).format(new Date());
  const systemPrompt = [
    "你是轻记的 AI 任务协作助手。你通过对话帮助用户创建或编辑任务。",
    "当前时间（Asia/Shanghai）：" + current + "。",
    "只返回一个 JSON 对象，不要 Markdown，不要补充说明。",
    "格式必须是：{\"reply\":\"给用户的简短回复\",\"action\":\"create|update|none\",\"task\":{...}}。",
    "task 可包含 title、content、category（task/meeting/progress/need）、summary、actionItems（最多3条）、dueDate（YYYY-MM-DD或null）、dueTime（HH:mm或null）、priority（high/normal/low）、reminder、completed、clarification。",
    "引用了任务时，除非用户明确要求另建任务，否则 action 使用 update，并在 task 中返回修改后的完整任务字段。未引用任务且用户表达了可执行事项时使用 create。只是询问或信息不足时使用 none。",
    "不要编造日期、时间、负责人或事实。相对日期按当前时间计算；存在关键歧义时 action 使用 none，并在 reply 中提出一个简短问题。",
  ].join("\n");
  const context = referencedRecord ? JSON.stringify({
    title: referencedRecord.title,
    content: referencedRecord.content,
    category: referencedRecord.type,
    summary: referencedRecord.summary,
    actionItems: referencedRecord.points,
    dueDate: referencedRecord.dueDate || null,
    dueTime: referencedRecord.dueTime || null,
    priority: referencedRecord.priority,
    reminder: referencedRecord.reminder,
    completed: referencedRecord.completed,
  }) : "未引用任务";
  const conversation = state.chatMessages
    .filter((message) => !message.pending)
    .slice(0, -1)
    .slice(-6)
    .map((message) => ({ role: message.role === "assistant" ? "assistant" : "user", content: message.content }));
  const content = await withAITimeout((signal) => callModel([
    { role: "system", content: systemPrompt + "\n当前引用任务：" + context },
    ...conversation,
    { role: "user", content: userMessage },
  ], signal, 1400));
  return parseJSONObject(content);
}

function applyChatResult(result, userMessage, referencedRecord) {
  const action = ["create", "update", "none"].includes(result.action) ? result.action : "none";
  const task = result.task && typeof result.task === "object" ? result.task : {};
  let clarification = typeof task.clarification === "string" ? task.clarification.trim().slice(0, 180) : "";
  if (!clarification && typeof result.clarification === "string") clarification = result.clarification.trim().slice(0, 180);
  let record = referencedRecord;
  let resultLabel = "没有修改任务";
  if (action === "create") {
    record = {
      id: makeId(),
      title: userMessage.slice(0, 42),
      content: userMessage,
      type: "task",
      time: nowTime(),
      dueDate: "",
      dueTime: "",
      priority: "normal",
      reminder: false,
      pinned: false,
      completed: false,
      organized: true,
      summary: userMessage,
      clarification: "",
      points: [],
    };
    clarification = applyTaskPayload(record, task, true) || clarification;
    state.records.unshift(record);
    resultLabel = "已创建任务 · " + record.title;
  } else if (action === "update" && record) {
    clarification = applyTaskPayload(record, task, true) || clarification;
    resultLabel = "已更新任务 · " + record.title;
  }
  if (record && action !== "none") {
    state.chatRecordId = record.id;
    state.selectedId = record.id;
    delete state.aiErrors[record.id];
    saveRecords();
    setFilter(record.completed ? "completed" : !record.dueDate ? "inbox" : record.dueDate > todayISO ? "planned" : "today");
  }
  return { record, resultLabel, changed: action !== "none" && Boolean(record), clarification };
}

function friendlyAIError(error) {
  if (error?.name === "AbortError") return "模型响应超时，请检查网络后重试。";
  if (error?.message === "INVALID_ENDPOINT") return "API 地址格式不正确。";
  if (error?.message === "INSECURE_ENDPOINT") return "公开 API 地址必须使用 HTTPS；HTTP 仅限 localhost。";
  if (error?.message === "MISSING_MODEL") return "请先填写模型名称。";
  if (error?.message === "MISSING_KEY") return "请先填写 API Key。";
  if (error?.message === "INVALID_RESPONSE" || error?.message === "INVALID_JSON") return "模型返回的内容无法识别，请重试或更换模型。";
  if (error?.message === "API_ERROR" && error.httpStatus === 400 && error.provider === "deepseek") {
    const detail = error.providerMessage ? "“" + error.providerMessage + "” " : "";
    return "DeepSeek 拒绝请求（400）：" + detail + "请使用 deepseek-flash 或 deepseek-v4-pro。";
  }
  if (error?.message === "API_ERROR" && error.httpStatus === 400) return "请求参数被模型服务拒绝（400）" + (error.providerMessage ? "：" + error.providerMessage : "，请检查模型名称。");
  if (error?.message === "API_ERROR" && [401, 403].includes(error.httpStatus)) return "认证失败，请检查 API Key 和模型权限。";
  if (error?.message === "API_ERROR" && error.httpStatus === 402) return "模型账户余额不足，请先充值或检查额度。";
  if (error?.message === "API_ERROR" && error.httpStatus === 404) return "API 地址或模型名称不存在。";
  if (error?.message === "API_ERROR" && error.httpStatus === 429) return "请求过于频繁或额度不足，请稍后重试。";
  if (error?.message === "API_ERROR") return "模型服务返回错误（HTTP " + error.httpStatus + "）。";
  if (error instanceof TypeError) return "无法连接模型服务。请检查网络、API 地址及浏览器跨域设置。";
  return "模型连接失败，请检查配置后重试。";
}

function deleteRecord(record) {
  const index = state.records.findIndex((item) => item.id === record.id);
  if (index < 0) return;
  state.deletedRecord = { record: clone(record), index };
  state.records.splice(index, 1);
  state.selectedId = null;
  if (state.chatRecordId === record.id) {
    state.chatRecordId = null;
    state.chatMessages = [{ role: "assistant", content: "这条任务已删除。你可以继续告诉我新的任务。" }];
  }
  saveRecords();
  render();
  announce("记录已删除", () => {
    if (!state.deletedRecord) return;
    state.records.splice(state.deletedRecord.index, 0, state.deletedRecord.record);
    state.selectedId = state.deletedRecord.record.id;
    state.deletedRecord = null;
    saveRecords();
    render();
    announce("已撤销删除");
  });
}

function renderWidget() {
  const container = $("#widget-records");
  container.replaceChildren();
  const active = state.records.filter((record) => !record.completed).slice(0, 3);
  active.forEach((record) => {
    const row = document.createElement("div");
    row.className = "widget-row";
    const check = document.createElement("button");
    check.type = "button";
    check.className = "widget-check";
    check.setAttribute("aria-label", "完成“" + record.title + "”");
    check.textContent = "○";
    check.addEventListener("click", () => { record.completed = true; saveRecords(); announce("已完成"); render(); });
    const text = document.createElement("button");
    text.type = "button";
    text.className = "widget-open";
    text.textContent = state.settings.privateWidget ? "私密记录" : record.title;
    text.addEventListener("click", () => { state.selectedId = record.id; $("#widget-dialog").close(); $("#detail-panel").classList.add("active"); render(); });
    row.append(check, text);
    container.append(row);
  });
  $("#widget-summary").textContent = active.length + " 条待处理";
}

function render() {
  updateCounts();
  renderChat();
  renderRecords();
  renderDetail();
  renderWidget();
}

function createRecord(rawText, explicitType = "auto", options = {}) {
  const text = rawText.trim();
  if (!text) return null;
  const parts = text.split("\n");
  const firstLine = parts.shift();
  const type = explicitType === "auto" ? inferType(text) : explicitType;
  const record = { id: makeId(), title: firstLine.slice(0, 42), content: parts.join("\n").trim() || firstLine, type, time: nowTime(), dueDate: options.dueDate || "", dueTime: options.dueDate ? (options.dueTime || "") : "", priority: options.priority || "normal", reminder: Boolean(options.dueDate && options.reminder), pinned: false, completed: false, organized: false, points: [] };
  state.records.unshift(record);
  setFilter(!record.dueDate ? "inbox" : record.dueDate > todayISO ? "planned" : "today");
  state.selectedId = record.id;
  $("#detail-panel").classList.add("active");
  saveRecords();
  render();
  return record;
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const userMessage = input.value.trim();
  if (!userMessage || state.chatBusy) { input.focus(); return; }
  if (!hasAIConfiguration()) {
    hydrateAISettings();
    openDialog("settings-dialog");
    setConnectionStatus("请先配置并测试 AI 模型，再开始任务协作。", "error");
    $("#ai-provider").focus();
    return;
  }
  const referencedRecord = getRecord(state.chatRecordId);
  addChatMessage("user", userMessage);
  state.chatMessages.push({ role: "assistant", content: referencedRecord ? "正在读取并修改这条任务…" : "正在把你的想法整理成任务…", pending: true });
  state.chatBusy = true;
  input.value = "";
  renderChat();
  try {
    const result = await requestAITaskCollaboration(userMessage, referencedRecord);
    state.chatMessages = state.chatMessages.filter((message) => !message.pending);
    const applied = applyChatResult(result, userMessage, referencedRecord);
    const baseReply = typeof result.reply === "string" && result.reply.trim() ? result.reply.trim().slice(0, 600) : applied.changed ? "已经按你的要求处理好了。" : "我还需要更多信息才能处理。";
    const reply = applied.clarification && !baseReply.includes(applied.clarification) ? baseReply + "\n" + applied.clarification : baseReply;
    addChatMessage("assistant", reply, applied.resultLabel);
    if (applied.changed) {
      $("#detail-panel").classList.add("active");
      announce(applied.resultLabel);
    }
  } catch (error) {
    state.chatMessages = state.chatMessages.filter((message) => !message.pending);
    addChatMessage("assistant", friendlyAIError(error) + " 你的任务没有被修改。");
  } finally {
    state.chatBusy = false;
    render();
    input.focus();
  }
});
input.addEventListener("keydown", (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key === "Enter") form.requestSubmit();
});

document.querySelectorAll(".nav-item").forEach((item) => {
  item.addEventListener("click", () => {
    setFilter(item.dataset.filter);
    render();
  });
});

$("#focus-capture").addEventListener("click", () => input.focus());
$("#empty-add").addEventListener("click", () => setChatContext(null, false));
chatTaskPicker.addEventListener("change", (event) => setChatContext(event.target.value));
$("#clear-task-context").addEventListener("click", () => setChatContext(null));
$("#close-detail").addEventListener("click", () => {
  state.selectedId = null;
  $("#detail-panel").classList.remove("active");
  document.querySelectorAll(".record-card").forEach((card) => card.classList.remove("selected"));
  detailContent.innerHTML = '<div class="detail-empty"><p>选择一条记录查看详情。</p></div>';
});

function openDialog(id) {
  const dialog = $("#" + id);
  if (!dialog.open) dialog.showModal();
}
$("#open-widget").addEventListener("click", () => openDialog("widget-dialog"));
$("#mobile-widget").addEventListener("click", () => openDialog("widget-dialog"));
$("#mobile-filter").addEventListener("change", (event) => { setFilter(event.target.value); render(); });
$("#widget-add").addEventListener("click", () => { $("#widget-dialog").close(); setChatContext(null, false); });
$("#open-feedback").addEventListener("click", () => openDialog("feedback-dialog"));
$("#open-settings").addEventListener("click", () => { hydrateAISettings(); openDialog("settings-dialog"); });
document.querySelectorAll("[data-close]").forEach((button) => button.addEventListener("click", () => $("#" + button.dataset.close).close()));
document.querySelectorAll("dialog").forEach((dialog) => dialog.addEventListener("click", (event) => { if (event.target === dialog) dialog.close(); }));

const ratings = ["很费劲", "有点卡", "还可以", "很顺手", "想继续用"];
ratings.forEach((label, index) => {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "rating-button";
  button.textContent = index + 1 + " " + label;
  button.addEventListener("click", () => {
    state.rating = index + 1;
    document.querySelectorAll(".rating-button").forEach((item, itemIndex) => item.classList.toggle("active", itemIndex === index));
  });
  $("#rating-options").append(button);
});

$("#feedback-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const feedback = { rating: state.rating, comment: $("#feedback-text").value.trim(), createdAt: new Date().toISOString() };
  const saved = JSON.parse(localStorage.getItem(FEEDBACK_KEY) || "[]");
  saved.push(feedback);
  localStorage.setItem(FEEDBACK_KEY, JSON.stringify(saved));
  $("#feedback-form").hidden = true;
  $("#feedback-success").hidden = false;
});

$("#copy-feedback").addEventListener("click", async () => {
  const saved = JSON.parse(localStorage.getItem(FEEDBACK_KEY) || "[]");
  const latest = saved.at(-1) || {};
  const text = "轻记原型反馈\n评分：" + (latest.rating || "未评分") + "/5\n意见：" + (latest.comment || "无");
  try { await navigator.clipboard.writeText(text); announce("反馈已复制"); }
  catch { announce("请手动复制反馈"); }
});
$("#more-feedback").addEventListener("click", () => {
  state.rating = 0;
  $("#feedback-text").value = "";
  document.querySelectorAll(".rating-button").forEach((item) => item.classList.remove("active"));
  $("#feedback-form").hidden = false;
  $("#feedback-success").hidden = true;
});

function applyTheme() {
  document.documentElement.dataset.theme = state.settings.theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : state.settings.theme === "dark" ? "dark" : "light";
  $("#theme-select").value = state.settings.theme;
  $("#privacy-toggle").checked = state.settings.privateWidget;
}
function saveSettings() {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(state.settings));
  applyTheme();
  renderWidget();
}

function setConnectionStatus(message, kind = "") {
  const status = $("#ai-connection-status");
  const badge = $("#ai-connection-badge");
  status.textContent = message;
  status.className = "connection-status" + (kind ? " " + kind : "");
  badge.className = "connection-badge" + (kind ? " " + kind : "");
  badge.textContent = kind === "success" ? "已连接" : kind === "error" ? "连接失败" : hasAIConfiguration() ? "待测试" : "未配置";
}

function hydrateAISettings() {
  const config = getAIConfig();
  $("#ai-provider").value = config.provider;
  $("#ai-endpoint").value = config.endpoint;
  $("#ai-model").value = config.model;
  $("#ai-model").placeholder = config.modelPlaceholder;
  const modelOptions = $("#ai-model-options");
  modelOptions.replaceChildren();
  config.modelOptions.forEach((model) => {
    const option = document.createElement("option");
    option.value = model;
    modelOptions.append(option);
  });
  $("#ai-api-key").value = getApiKey();
  $("#ai-api-key").placeholder = config.keyPlaceholder;
  $("#ai-api-key").type = "password";
  $("#toggle-api-key").textContent = "显示密钥";
  $("#ai-provider-note").textContent = config.note + " 使用 AI 协作时会发送对话和引用任务；公开接口需使用 HTTPS 并允许跨域请求。";
  setConnectionStatus(hasAIConfiguration() ? "配置已保存在本次会话中，可测试连接。" : "API Key 只保存在当前标签页，关闭后自动清除。", "");
}

function persistAIInputs() {
  const provider = state.settings.aiProvider;
  state.settings.aiProfiles[provider] = {
    endpoint: $("#ai-endpoint").value.trim(),
    model: $("#ai-model").value.trim(),
  };
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(state.settings));
  const key = $("#ai-api-key").value.trim();
  if (key) sessionStorage.setItem(AI_KEY_SESSION_PREFIX + provider, key);
  else sessionStorage.removeItem(AI_KEY_SESSION_PREFIX + provider);
  if (provider === "openai") sessionStorage.removeItem(LEGACY_AI_KEY_SESSION_KEY);
}

$("#ai-provider").addEventListener("change", (event) => {
  persistAIInputs();
  state.settings.aiProvider = event.target.value;
  if (!state.settings.aiProfiles[state.settings.aiProvider]) {
    state.settings.aiProfiles[state.settings.aiProvider] = { endpoint: aiProviders[state.settings.aiProvider].endpoint, model: aiProviders[state.settings.aiProvider].defaultModel || "" };
  }
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(state.settings));
  hydrateAISettings();
  setConnectionStatus("已切换到 " + getAIConfig().name + "，请填写模型名称和 API Key。", "");
});
$("#ai-endpoint").addEventListener("change", () => { persistAIInputs(); setConnectionStatus("配置已更新，请重新测试连接。", ""); });
$("#ai-model").addEventListener("change", () => { persistAIInputs(); setConnectionStatus("配置已更新，请重新测试连接。", ""); });
$("#ai-api-key").addEventListener("input", () => { persistAIInputs(); setConnectionStatus("API Key 已写入本次会话，请测试连接。", ""); });
$("#toggle-api-key").addEventListener("click", () => {
  const keyInput = $("#ai-api-key");
  const showing = keyInput.type === "text";
  keyInput.type = showing ? "password" : "text";
  $("#toggle-api-key").textContent = showing ? "显示密钥" : "隐藏密钥";
});
$("#clear-api-key").addEventListener("click", () => {
  sessionStorage.removeItem(AI_KEY_SESSION_PREFIX + state.settings.aiProvider);
  if (state.settings.aiProvider === "openai") sessionStorage.removeItem(LEGACY_AI_KEY_SESSION_KEY);
  $("#ai-api-key").value = "";
  setConnectionStatus("本次会话中的 API Key 已清除。", "");
});
$("#test-ai-connection").addEventListener("click", async () => {
  const button = $("#test-ai-connection");
  persistAIInputs();
  button.disabled = true;
  button.textContent = "正在连接…";
  setConnectionStatus("正在向 " + getAIConfig().name + " 发送一条不含记录内容的测试消息…", "");
  try {
    await withAITimeout((signal) => callModel([{ role: "user", content: "请只回复 OK，用于验证 API 连接。" }], signal, 32), 20000);
    setConnectionStatus(getAIConfig().name + " 连接成功，可以开始 AI 任务协作。", "success");
    announce("模型连接成功");
  } catch (error) {
    setConnectionStatus(friendlyAIError(error), "error");
  } finally {
    button.disabled = false;
    button.textContent = "测试连接";
  }
});

$("#theme-select").addEventListener("change", (event) => { state.settings.theme = event.target.value; saveSettings(); });
$("#privacy-toggle").addEventListener("change", (event) => { state.settings.privateWidget = event.target.checked; saveSettings(); announce(event.target.checked ? "小组件内容已隐藏" : "小组件内容已显示"); });

document.addEventListener("keydown", (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "n") { event.preventDefault(); input.focus(); }
});
const today = new Date();
const fullDate = new Intl.DateTimeFormat("zh-CN", { month: "long", day: "numeric", weekday: "long" }).format(today);
$("#current-date").textContent = fullDate.replace("星期", " · 星期");
$("#widget-date").textContent = fullDate;
applyTheme();
hydrateAISettings();

if (document.modelContext?.registerTool) {
  try {
    document.modelContext.registerTool({
      name: "list_qingji_records",
      title: "读取轻记记录",
      description: "读取轻记原型中当前保存的记录。",
      inputSchema: { type: "object", properties: {} },
      annotations: { readOnlyHint: true, untrustedContentHint: true },
      execute: async () => ({ records: clone(state.records) }),
    });
    document.modelContext.registerTool({
      name: "create_qingji_record",
      title: "创建轻记记录",
      description: "在轻记原型中新建一条记录。",
      inputSchema: { type: "object", properties: { text: { type: "string", minLength: 1, description: "记录内容" }, type: { type: "string", enum: ["auto", "task", "meeting", "progress", "need"] } }, required: ["text"], additionalProperties: false },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute: async ({ text, type = "auto" }) => {
        if (typeof text !== "string" || !text.trim()) throw new Error("记录内容不能为空。");
        const record = createRecord(text, type);
        return { id: record.id, title: record.title, type: record.type };
      },
    });
  } catch {
    // WebMCP is an optional progressive enhancement.
  }
}

render();
