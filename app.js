const FORM_DRAFT_KEY = "prontdiu.form.v1";
const RECORDS_KEY = "prontdiu.records.v1";
const EDITING_RECORD_KEY = "prontdiu.editingRecordId.v1";

const form = document.getElementById("diuForm");
const clearBtn = document.getElementById("clearBtn");
const newRecordBtn = document.getElementById("newRecordBtn");
const printBtn = document.getElementById("printBtn");
const formView = document.getElementById("formView");
const toastTemplate = document.getElementById("toastTemplate");

let saveTimer = null;
let toastTimer = null;
let currentView = "form";

window.prontDiuApp = {
  clearForm: (event) => {
    event?.preventDefault?.();
    clearCurrentForm();
  },
  saveRecord: (event) => {
    event?.preventDefault?.();
    persistRecord({ redirectToRecords: true });
  },
  printForm: (event) => {
    event?.preventDefault?.();
    handlePrintAction();
  },
};

function getFieldValue(field) {
  if (field.type === "checkbox") {
    return field.checked;
  }

  if (field.type === "radio") {
    if (!field.checked) return null;
    return field.value;
  }

  return field.value;
}

function setFieldValue(field, value) {
  if (field.type === "checkbox") {
    field.checked = Boolean(value);
    return;
  }

  if (field.type === "radio") {
    field.checked = field.value === value;
    return;
  }

  field.value = value ?? "";
}

function collectFormData() {
  const data = {};
  const elements = Array.from(form.elements);

  for (const field of elements) {
    if (!field.name || field.disabled) continue;

    if (field.type === "checkbox" && field.name in data) {
      if (!Array.isArray(data[field.name])) {
        data[field.name] = [];
      }
      if (field.checked) {
        data[field.name].push(field.value || true);
      }
      continue;
    }

    if (field.type === "checkbox") {
      data[field.name] = field.checked;
      continue;
    }

    if (field.type === "radio") {
      if (field.checked) {
        data[field.name] = field.value;
      } else if (!(field.name in data)) {
        data[field.name] = "";
      }
      continue;
    }

    data[field.name] = getFieldValue(field);
  }

  const multiValues = {};
  const checkboxGroups = new Set();

  for (const field of elements) {
    if (!field.name || field.type !== "checkbox") continue;
    if (!checkboxGroups.has(field.name)) {
      checkboxGroups.add(field.name);
      const group = elements.filter((candidate) => candidate.name === field.name && candidate.type === "checkbox");
      if (group.length > 1) {
        multiValues[field.name] = group.filter((candidate) => candidate.checked).map((candidate) => candidate.value || true);
      }
    }
  }

  return { ...data, ...multiValues };
}

function restoreFormData(data) {
  const elements = Array.from(form.elements);
  const handledCheckboxGroups = new Set();

  for (const field of elements) {
    if (!field.name || field.disabled || !(field.name in data)) continue;

    if (field.type === "checkbox") {
      const group = elements.filter((candidate) => candidate.name === field.name && candidate.type === "checkbox");
      if (group.length > 1) {
        if (handledCheckboxGroups.has(field.name)) continue;
        const values = Array.isArray(data[field.name]) ? data[field.name] : [];
        for (const checkbox of group) {
          checkbox.checked = values.includes(checkbox.value || true);
        }
        handledCheckboxGroups.add(field.name);
      } else {
        field.checked = Boolean(data[field.name]);
      }
      continue;
    }

    if (field.type === "radio") {
      field.checked = field.value === data[field.name];
      continue;
    }

    setFieldValue(field, data[field.name]);
  }
}

function showToast(message) {
  const toast = toastTemplate.content.firstElementChild.cloneNode(true);
  toast.textContent = message;
  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add("show"));

  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    toast.classList.remove("show");
    window.setTimeout(() => toast.remove(), 200);
  }, 2200);
}

function readJSON(key, fallback) {
  const raw = localStorage.getItem(key);
  if (!raw) return fallback;

  try {
    return JSON.parse(raw);
  } catch (error) {
    console.error(`Falha ao ler ${key}`, error);
    return fallback;
  }
}

function writeJSON(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function loadDraft() {
  const draft = readJSON(FORM_DRAFT_KEY, null);
  if (!draft || typeof draft !== "object") return false;
  restoreFormData(draft);
  return true;
}

function saveDraft(data = collectFormData()) {
  writeJSON(FORM_DRAFT_KEY, data);
}

function clearDraft() {
  localStorage.removeItem(FORM_DRAFT_KEY);
}

function loadRecords() {
  const records = readJSON(RECORDS_KEY, []);
  return Array.isArray(records) ? records : [];
}

function saveRecords(records) {
  writeJSON(RECORDS_KEY, records);
}

function getEditingRecordId() {
  return sessionStorage.getItem(EDITING_RECORD_KEY);
}

function setEditingRecordId(recordId) {
  if (!recordId) {
    sessionStorage.removeItem(EDITING_RECORD_KEY);
    return;
  }

  sessionStorage.setItem(EDITING_RECORD_KEY, recordId);
}

function generateRecordId() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID();
  }

  return `record-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function formatDateTime(isoString) {
  if (!isoString) return "Sem data";

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(isoString));
}

function formatDateOnly(isoString) {
  if (!isoString) return "Sem data";

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "medium",
  }).format(new Date(isoString));
}

function getRecordDisplayName(record) {
  const rawName = record?.data?.patientName?.trim();
  return rawName || "Nome não informado";
}

function loadCurrentFormState() {
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.has('new')) {
    clearCurrentForm();
    return false;
  }

  const editingRecordId = getEditingRecordId();
  if (editingRecordId) {
    const record = loadRecords().find((item) => item.id === editingRecordId);
    if (record) {
      restoreFormData(record.data);
      return true;
    }
    setEditingRecordId(null);
  }

  return loadDraft();
}

function persistRecord({ clearAfterSave = false, redirectToRecords = false } = {}) {
  const formData = collectFormData();
  const now = new Date().toISOString();
  const editingRecordId = getEditingRecordId();
  const records = loadRecords();
  const existingIndex = editingRecordId ? records.findIndex((record) => record.id === editingRecordId) : -1;
  let savedRecordId = editingRecordId;

  if (existingIndex >= 0) {
    const existingRecord = records[existingIndex];
    savedRecordId = existingRecord.id;
    records[existingIndex] = {
      ...existingRecord,
      updatedAt: now,
      data: formData,
    };
  } else {
    const newRecord = {
      id: generateRecordId(),
      createdAt: now,
      updatedAt: now,
      data: formData,
    };
    records.push(newRecord);
    savedRecordId = newRecord.id;
  }

  saveRecords(records);
  saveDraft(formData);
  if (!clearAfterSave) {
    setEditingRecordId(savedRecordId);
  }
  showToast(existingIndex >= 0 ? "Prontuário atualizado" : "Prontuário salvo");


  if (clearAfterSave) {
    clearCurrentForm();
  }

  if (redirectToRecords) {
    // redireciona para a página dedicada de lista de prontuários
    location.href = "records.html";
  }
}

function clearCurrentForm() {
  if (saveTimer) {
    window.clearTimeout(saveTimer);
    saveTimer = null;
  }

  form.reset();
  setEditingRecordId(null);
  clearDraft();
  const url = new URL(window.location.href);
  url.search = "";
  window.history.replaceState({}, "", url.toString());
  showToast("Formulário limpo");
}

function openRecordForEdit(recordId) {
  const record = loadRecords().find((item) => item.id === recordId);
  if (!record) {
    showToast("Prontuário não encontrado");
    return;
  }

  setEditingRecordId(recordId);
  restoreFormData(record.data);
  saveDraft(record.data);
  openFormView();
  window.scrollTo({ top: 0, behavior: "smooth" });
  showToast(`Prontuário de ${getRecordDisplayName(record)} aberto para edição`);
}

function handleNewRecordAction() {
  clearCurrentForm();
}

function scheduleAutoSave() {
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    saveDraft();
  }, 700);
}

function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch((error) => {
      console.warn("Service worker não registrado", error);
    });
  }
}

form.addEventListener("input", scheduleAutoSave);
form.addEventListener("change", scheduleAutoSave);
if (form) {
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    // sempre redireciona para a lista após salvar para visual feedback
    persistRecord({ redirectToRecords: true });
  });
}

if (clearBtn) {
  clearBtn.addEventListener("click", () => {
    const confirmed = window.confirm("Deseja limpar o formulário e apagar o rascunho salvo?");
    if (confirmed) {
      clearCurrentForm();
    }
  });
}

if (newRecordBtn) {
  newRecordBtn.addEventListener("click", handleNewRecordAction);
}

function buildPrintableHtml(dataHtml) {
  return `<!doctype html><html><head><meta charset=\"utf-8\"><title>Imprimir prontuário</title>
    <link rel=\"stylesheet\" href=\"styles.css\"> <style>body{padding:20px;font-family:Inter,system-ui,sans-serif} .card{box-shadow:none;border:0}</style>
    </head><body>${dataHtml}</body></html>`;
}

function handlePrintAction() {
  try {
    // Esconde os botões da seção de ações do formulário
    const formActions = document.querySelector('.form-actions');
    const wasHidden = formActions?.style.display;
    if (formActions) formActions.style.display = 'none';

    // Dispara o print do navegador
    window.print();

    // Restaura os botões após um pequeno atraso
    setTimeout(() => {
      if (formActions) formActions.style.display = wasHidden || '';
    }, 100);
  } catch (err) {
    console.error(err);
    showToast("Erro ao preparar impressão");
  }
}

window.addEventListener("beforeunload", () => {
  if (saveTimer) {
    window.clearTimeout(saveTimer);
    saveDraft();
  }
});

loadCurrentFormState();
registerServiceWorker();
