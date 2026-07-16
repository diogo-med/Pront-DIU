const STORAGE_KEY = "prontdiu.form.v1";
const LAST_SAVED_KEY = "prontdiu.savedAt.v1";

const form = document.getElementById("diuForm");
const saveBtn = document.getElementById("saveBtn");
const clearBtn = document.getElementById("clearBtn");
const newRecordBtn = document.getElementById("newRecordBtn");
const printBtn = document.getElementById("printBtn");
const toastTemplate = document.getElementById("toastTemplate");

let saveTimer = null;
let toastTimer = null;

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

function saveDraft() {
  const payload = {
    savedAt: new Date().toISOString(),
    data: collectFormData(),
  };

  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload.data));
  localStorage.setItem(LAST_SAVED_KEY, payload.savedAt);
  showToast("Rascunho salvo localmente");
}

function loadDraft() {
  const rawData = localStorage.getItem(STORAGE_KEY);
  if (!rawData) return false;

  try {
    const data = JSON.parse(rawData);
    restoreFormData(data);
    return true;
  } catch (error) {
    console.error("Falha ao carregar rascunho", error);
    return false;
  }
}

function clearDraft() {
  form.reset();
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(LAST_SAVED_KEY);
  showToast("Formulário limpo");
}

function scheduleAutoSave() {
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(saveDraft, 700);
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
form.addEventListener("submit", (event) => {
  event.preventDefault();
  saveDraft();
  showToast("Prontuário salvo no dispositivo");
});

saveBtn.addEventListener("click", saveDraft);
clearBtn.addEventListener("click", () => {
  const confirmed = window.confirm("Deseja limpar o formulário e apagar o rascunho salvo?");
  if (confirmed) {
    clearDraft();
  }
});
newRecordBtn.addEventListener("click", () => {
  const confirmed = window.confirm("Criar um novo prontuário? O rascunho atual será apagado.");
  if (confirmed) {
    clearDraft();
  }
});
printBtn.addEventListener("click", () => window.print());

window.addEventListener("beforeunload", () => {
  if (saveTimer) {
    window.clearTimeout(saveTimer);
    saveDraft();
  }
});

loadDraft();
registerServiceWorker();
