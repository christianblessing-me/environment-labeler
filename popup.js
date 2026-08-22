const STORAGE_KEY = "environmentLabelRules";

const form = document.querySelector("#ruleForm");
const ruleIdInput = document.querySelector("#ruleId");
const urlPatternInput = document.querySelector("#urlPattern");
const matchTypeInput = document.querySelector("#matchType");
const labelTextInput = document.querySelector("#labelText");
const labelColorInput = document.querySelector("#labelColor");
const fontSizeInput = document.querySelector("#fontSize");
const opacityInput = document.querySelector("#opacity");
const positionInput = document.querySelector("#position");
const offsetXInput = document.querySelector("#offsetX");
const offsetYInput = document.querySelector("#offsetY");
const offsetXLabel = document.querySelector("#offsetXLabel");
const offsetYLabel = document.querySelector("#offsetYLabel");
const cornerPicker = document.querySelector("#cornerPicker");
const cornerButtons = document.querySelectorAll(".corner-option");
const enabledInput = document.querySelector("#enabled");
const addRuleButton = document.querySelector("#addRule");
const deleteRuleButton = document.querySelector("#deleteRule");
const importRulesButton = document.querySelector("#importRules");
const exportRulesButton = document.querySelector("#exportRules");
const importFileInput = document.querySelector("#importFile");
const useCurrentUrlButton = document.querySelector("#useCurrentUrl");
const useCurrentDomainButton = document.querySelector("#useCurrentDomain");
const rulesList = document.querySelector("#rulesList");
const emptyState = document.querySelector("#emptyState");
const currentUrl = document.querySelector("#currentUrl");
const ruleTemplate = document.querySelector("#ruleTemplate");

let rules = [];
let activeTabUrl = "";

function createRuleId() {
  return `rule-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function defaultRule() {
  return {
    id: "",
    urlPattern: "",
    matchType: "contains",
    label: "",
    color: "#ef4444",
    fontSize: 60,
    opacity: 50,
    position: "upper-right",
    offsetX: 2,
    offsetY: 2,
    enabled: true
  };
}

function normalizePercentage(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return 50;
  }

  return Math.min(100, Math.max(0, Math.round(number)));
}

function normalizeFontSize(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return 60;
  }

  return Math.min(120, Math.max(10, Math.round(number)));
}

function normalizePosition(value) {
  const allowedPositions = ["upper-right", "upper-left", "lower-right", "lower-left"];
  return allowedPositions.includes(value) ? value : "upper-right";
}

function normalizeMatchType(value) {
  const allowedTypes = ["contains", "wildcard", "regex", "exact", "domain"];
  return allowedTypes.includes(value) ? value : "contains";
}

function normalizeOffset(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return 2;
  }

  return Math.min(100, Math.max(0, Math.round(number)));
}

function normalizeRule(rule) {
  return {
    ...defaultRule(),
    ...rule,
    label: (rule.label || "").toUpperCase(),
    matchType: normalizeMatchType(rule.matchType),
    fontSize: normalizeFontSize(rule.fontSize),
    opacity: normalizePercentage(rule.opacity),
    position: normalizePosition(rule.position),
    offsetX: normalizeOffset(rule.offsetX),
    offsetY: normalizeOffset(rule.offsetY)
  };
}

function positionLabels(position) {
  switch (position) {
    case "upper-left":
      return { x: "Left %", y: "Top %" };
    case "lower-left":
      return { x: "Left %", y: "Bottom %" };
    case "lower-right":
      return { x: "Right %", y: "Bottom %" };
    case "upper-right":
    default:
      return { x: "Right %", y: "Top %" };
  }
}

function setSelectedPosition(position) {
  const normalizedPosition = normalizePosition(position);
  const labels = positionLabels(normalizedPosition);

  positionInput.value = normalizedPosition;
  offsetXLabel.textContent = labels.x;
  offsetYLabel.textContent = labels.y;
  cornerPicker.className = `corner-picker is-${normalizedPosition}`;

  for (const button of cornerButtons) {
    const isSelected = button.dataset.position === normalizedPosition;
    button.setAttribute("aria-pressed", String(isSelected));
  }
}

function readForm() {
  return {
    id: ruleIdInput.value || createRuleId(),
    urlPattern: urlPatternInput.value.trim(),
    matchType: normalizeMatchType(matchTypeInput.value),
    label: labelTextInput.value.trim().toUpperCase(),
    color: labelColorInput.value,
    fontSize: normalizeFontSize(fontSizeInput.value),
    opacity: normalizePercentage(opacityInput.value),
    position: normalizePosition(positionInput.value),
    offsetX: normalizeOffset(offsetXInput.value),
    offsetY: normalizeOffset(offsetYInput.value),
    enabled: enabledInput.checked
  };
}

function writeForm(rule) {
  const normalizedRule = normalizeRule(rule);

  ruleIdInput.value = normalizedRule.id;
  urlPatternInput.value = normalizedRule.urlPattern;
  matchTypeInput.value = normalizedRule.matchType;
  labelTextInput.value = normalizedRule.label;
  labelColorInput.value = normalizedRule.color;
  fontSizeInput.value = String(normalizedRule.fontSize);
  opacityInput.value = String(normalizedRule.opacity);
  offsetXInput.value = String(normalizedRule.offsetX);
  offsetYInput.value = String(normalizedRule.offsetY);
  setSelectedPosition(normalizedRule.position);
  enabledInput.checked = normalizedRule.enabled;
  deleteRuleButton.hidden = !normalizedRule.id;
}

async function loadRules() {
  const result = await chrome.storage.sync.get({ [STORAGE_KEY]: [] });
  rules = Array.isArray(result[STORAGE_KEY]) ? result[STORAGE_KEY].map(normalizeRule) : [];
}

async function saveRules() {
  await chrome.storage.sync.set({ [STORAGE_KEY]: rules });
}

function downloadRules() {
  const payload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    rules: rules.map(normalizeRule)
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = "environment-labeler-rules.json";
  link.click();
  URL.revokeObjectURL(url);
}

async function importRulesFile(file) {
  const text = await file.text();
  const parsed = JSON.parse(text);
  const importedRules = Array.isArray(parsed) ? parsed : parsed.rules;

  if (!Array.isArray(importedRules)) {
    throw new Error("Imported file does not contain a rules array.");
  }

  rules = importedRules.map(normalizeRule).map((rule) => ({
    ...rule,
    id: rule.id || createRuleId()
  }));
  await saveRules();
  writeForm(rules[0] || defaultRule());
  renderRules();
}

function renderRules() {
  rulesList.textContent = "";
  emptyState.hidden = rules.length > 0;
  const selectedRuleId = ruleIdInput.value;

  for (const rule of rules) {
    const node = ruleTemplate.content.firstElementChild.cloneNode(true);
    node.dataset.ruleId = rule.id;
    node.classList.toggle("is-selected", rule.id === selectedRuleId);
    node.querySelector(".swatch").style.backgroundColor = rule.color;
    node.querySelector(".rule-label").textContent = rule.label.toUpperCase();
    node.querySelector(".rule-url").textContent = rule.urlPattern;
    node.addEventListener("click", () => {
      writeForm(rule);
      renderRules();
    });
    rulesList.append(node);
  }
}

async function loadCurrentTabUrl() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  activeTabUrl = tab?.url || "";
  currentUrl.textContent = activeTabUrl || "Unavailable";
}

function resetForm() {
  writeForm(defaultRule());
  urlPatternInput.focus();
}

labelTextInput.addEventListener("input", () => {
  const cursorPosition = labelTextInput.selectionStart;
  labelTextInput.value = labelTextInput.value.toUpperCase();
  labelTextInput.setSelectionRange(cursorPosition, cursorPosition);
});

for (const button of cornerButtons) {
  button.addEventListener("click", () => {
    setSelectedPosition(button.dataset.position);
  });
}

addRuleButton.addEventListener("click", () => {
  resetForm();
  renderRules();
});

useCurrentUrlButton.addEventListener("click", () => {
  if (!activeTabUrl) return;

  urlPatternInput.value = activeTabUrl;
  matchTypeInput.value = "exact";
});

useCurrentDomainButton.addEventListener("click", () => {
  if (!activeTabUrl) return;

  try {
    urlPatternInput.value = new URL(activeTabUrl).hostname;
    matchTypeInput.value = "domain";
  } catch {
    urlPatternInput.value = activeTabUrl;
    matchTypeInput.value = "contains";
  }
});

exportRulesButton.addEventListener("click", downloadRules);

importRulesButton.addEventListener("click", () => {
  importFileInput.click();
});

importFileInput.addEventListener("change", async () => {
  const [file] = importFileInput.files;
  if (!file) return;

  try {
    await importRulesFile(file);
  } catch (error) {
    window.alert(error.message || "Could not import rules.");
  } finally {
    importFileInput.value = "";
  }
});

deleteRuleButton.addEventListener("click", async () => {
  const id = ruleIdInput.value;
  if (!id) return;

  rules = rules.filter((rule) => rule.id !== id);
  await saveRules();
  renderRules();
  resetForm();
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const rule = readForm();
  const existingIndex = rules.findIndex((item) => item.id === rule.id);

  if (existingIndex >= 0) {
    rules[existingIndex] = rule;
  } else {
    rules.push(rule);
  }

  await saveRules();
  writeForm(rule);
  renderRules();
});

document.addEventListener("DOMContentLoaded", async () => {
  await Promise.all([loadRules(), loadCurrentTabUrl()]);
  writeForm(rules[0] || defaultRule());
  renderRules();
});
