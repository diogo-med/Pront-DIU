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

function sanitizeInteger(value) {
  if (value === null || value === undefined || value === "") return "";
  const digitsOnly = String(value).replace(/\D/g, "");
  return digitsOnly;
}

function formatCpf(value) {
  const digits = sanitizeInteger(value).slice(0, 11);
  if (!digits) return "";

  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

function formatPhone(value) {
  const digits = sanitizeInteger(value).slice(0, 11);
  if (!digits) return "";

  if (digits.length < 3) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

function normalizeTypedFields(data) {
  const normalized = { ...data };

  normalized.recordNumber = sanitizeInteger(normalized.recordNumber);
  normalized.rg = sanitizeInteger(normalized.rg);
  normalized.cpf = sanitizeInteger(normalized.cpf);
  normalized.cns = sanitizeInteger(normalized.cns);
  normalized.phone = sanitizeInteger(normalized.phone);

  normalized.patientName = String(normalized.patientName ?? "").trim();

  return normalized;
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

  return normalizeTypedFields({ ...data, ...multiValues });
}

function restoreFormData(data) {
  const normalizedData = normalizeTypedFields(data);
  const elements = Array.from(form.elements);
  const handledCheckboxGroups = new Set();

  for (const field of elements) {
    if (!field.name || field.disabled || !(field.name in normalizedData)) continue;

    if (field.type === "checkbox") {
      const group = elements.filter((candidate) => candidate.name === field.name && candidate.type === "checkbox");
      if (group.length > 1) {
        if (handledCheckboxGroups.has(field.name)) continue;
        const values = Array.isArray(normalizedData[field.name]) ? normalizedData[field.name] : [];
        for (const checkbox of group) {
          checkbox.checked = values.includes(checkbox.value || true);
        }
        handledCheckboxGroups.add(field.name);
      } else {
        field.checked = Boolean(normalizedData[field.name]);
      }
      continue;
    }

    if (field.type === "radio") {
      field.checked = field.value === normalizedData[field.name];
      continue;
    }

    setFieldValue(field, normalizedData[field.name]);
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
    navigator.serviceWorker.register("sw.js")
      .then((registration) => {
        // Se houver uma atualização pendente e o navegador achar um sw novo
        registration.addEventListener("updatefound", () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener("statechange", () => {
              // Quando o novo SW terminar de instalar e for ativado
              if (newWorker.state === "activated") {
                console.log("Nova versão detectada! Recarregando...");
                window.location.reload(); // Recarrega para aplicar a atualização
              }
            });
          }
        });
      })
      .catch((error) => {
        console.warn("Service worker não registrado", error);
      });

    // Garante o recarregamento caso o SW mude em outra aba ativa
    let refreshing = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (!refreshing) {
        refreshing = true;
        window.location.reload();
      }
    });
  }
}

function calculateBMI() {
  const weightField = form.querySelector('[name="weight"]');
  const heightField = form.querySelector('[name="height"]');
  const bmiField = form.querySelector('[name="bmi"]');

  if (!weightField || !heightField || !bmiField) return;

  const weight = parseFloat(String(weightField.value).replace(",", "."));
  const heightCm = parseFloat(String(heightField.value).replace(",", "."));

  if (!Number.isFinite(weight) || !Number.isFinite(heightCm) || heightCm <= 0) {
    bmiField.value = "";
    return;
  }

  const heightMeters = heightCm / 100;
  const bmi = weight / (heightMeters * heightMeters);
  bmiField.value = bmi.toFixed(2);
}

function calculateAge() {
  const birthDateField = form.querySelector('[name="birthDate"]');
  const ageField = form.querySelector('[name="age"]');

  if (!birthDateField || !ageField) return;

  if (!birthDateField.value) {
    ageField.value = "";
    return;
  }

  const birthDate = new Date(`${birthDateField.value}T00:00:00`);
  if (Number.isNaN(birthDate.getTime())) {
    ageField.value = "";
    return;
  }

  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDifference = today.getMonth() - birthDate.getMonth();

  if (monthDifference < 0 || (monthDifference === 0 && today.getDate() < birthDate.getDate())) {
    age -= 1;
  }

  ageField.value = age >= 0 ? String(age) : "";
}

function setupAutoCalculations() {
  const weightField = form.querySelector('[name="weight"]');
  const heightField = form.querySelector('[name="height"]');
  const birthDateField = form.querySelector('[name="birthDate"]');

  weightField?.addEventListener("input", calculateBMI);
  heightField?.addEventListener("input", calculateBMI);
  birthDateField?.addEventListener("input", calculateAge);
  birthDateField?.addEventListener("change", calculateAge);

  calculateBMI();
  calculateAge();
}

function setupVisualMasks() {
  const cpfField = form.querySelector('[name="cpf"]');
  const phoneField = form.querySelector('[name="phone"]');

  if (cpfField) {
    cpfField.addEventListener("input", () => {
      cpfField.value = formatCpf(cpfField.value);
    });
    cpfField.value = formatCpf(cpfField.value);
  }

  if (phoneField) {
    phoneField.addEventListener("input", () => {
      phoneField.value = formatPhone(phoneField.value);
    });
    phoneField.value = formatPhone(phoneField.value);
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
setupAutoCalculations();
setupVisualMasks();
registerServiceWorker();
