const STORAGE_KEY = "qingji.prototype.records.v1";
const FEEDBACK_KEY = "qingji.prototype.feedback.v1";
const SETTINGS_KEY = "qingji.prototype.settings.v1";

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
      return { dueDate: "", dueTime: "", priority: "normal", reminder: false, pinned: false, ...migrated };
    });
  } catch {
    return clone(sampleRecords);
  }
};

const loadSettings = () => {
  try { return { theme: "system", privateWidget: false, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}") }; }
  catch { return { theme: "system", privateWidget: false }; }
};
const state = { records: loadRecords(), selectedId: null, filter: "today", captureType: "auto", rating: 0, deletedRecord: null, settings: loadSettings() };
const $ = (selector) => document.querySelector(selector);
const recordsElement = $("#records");
const emptyState = $("#empty-state");
const detailContent = $("#detail-content");
const input = $("#capture-input");
const form = $("#capture-form");
const toast = $("#toast");
const toastMessage = $("#toast-message");
const toastAction = $("#toast-action");

const saveRecords = () => localStorage.setItem(STORAGE_KEY, JSON.stringify(state.records));
const getRecord = (id) => state.records.find((record) => record.id === id);
const makeId = () => globalThis.crypto?.randomUUID?.() || "record-" + Date.now();
const nowTime = () => new Intl.DateTimeFormat("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date());

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
    card.append(select, check);
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
    summaryText.textContent = record.content;
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
    detailContent.append(block);
  }

  const actions = document.createElement("div");
  actions.className = "detail-actions";
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
  actions.append(edit, complete, tomorrow, remove);
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

function organizeRecord(record, button) {
  button.disabled = true;
  button.textContent = "AI 正在整理…";
  window.setTimeout(() => {
    record.organized = true;
    record.points = ["确认“" + record.title.slice(0, 12) + "”的负责人", "补充完成时间", "处理后在轻记中标记完成"];
    saveRecords();
    announce("AI 整理完成");
    render();
  }, 650);
}

function deleteRecord(record) {
  const index = state.records.findIndex((item) => item.id === record.id);
  if (index < 0) return;
  state.deletedRecord = { record: clone(record), index };
  state.records.splice(index, 1);
  state.selectedId = null;
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
  renderRecords();
  renderDetail();
  renderWidget();
}

function createRecord(rawText, explicitType = state.captureType, options = {}) {
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

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const record = createRecord(input.value, state.captureType, { dueDate: $("#capture-date").value, dueTime: $("#capture-time").value, priority: $("#capture-priority").value, reminder: $("#capture-reminder").checked });
  if (!record) { input.focus(); return; }
  input.value = "";
  $("#capture-date").value = "";
  $("#capture-time").value = "";
  $("#capture-priority").value = "normal";
  $("#capture-reminder").checked = false;
  $("#capture-schedule").hidden = true;
  $("#toggle-schedule").classList.remove("active");
  announce("记录已保存");
});
input.addEventListener("keydown", (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key === "Enter") form.requestSubmit();
});

document.querySelectorAll(".pill").forEach((pill) => {
  pill.addEventListener("click", () => {
    state.captureType = pill.dataset.type;
    document.querySelectorAll(".pill").forEach((item) => {
      const active = item === pill;
      item.classList.toggle("active", active);
      item.setAttribute("aria-pressed", String(active));
    });
  });
});

document.querySelectorAll(".nav-item").forEach((item) => {
  item.addEventListener("click", () => {
    setFilter(item.dataset.filter);
    render();
  });
});

$("#focus-capture").addEventListener("click", () => input.focus());
$("#empty-add").addEventListener("click", () => input.focus());
$("#toggle-schedule").addEventListener("click", () => {
  const panel = $("#capture-schedule");
  panel.hidden = !panel.hidden;
  $("#toggle-schedule").classList.toggle("active", !panel.hidden);
  if (!panel.hidden) $("#capture-date").focus();
});
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
$("#widget-add").addEventListener("click", () => { $("#widget-dialog").close(); input.focus(); });
$("#open-feedback").addEventListener("click", () => openDialog("feedback-dialog"));
$("#open-settings").addEventListener("click", () => openDialog("settings-dialog"));
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
