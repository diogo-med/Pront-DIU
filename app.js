import {
  getAllRecords,
  putRecord,
  deleteRecordById,
  getTriagemDraft,
  setTriagemDraft,
  clearTriagemDraft,
  getEditingRecordId,
  setEditingRecordId,
  runMigrations,
} from "./db.js";
import { showToast } from "./ui.js";
import {
  collectFormData,
  restoreFormData,
  setupAutoCalculations,
  setupVisualMasks,
  registerServiceWorker,
} from "./form-utils.js";
import { buildIdentificacaoHtml, buildSubjetivoHtml, openPrintWindow } from "./print.js";

const form = document.getElementById("diuForm");
const clearBtn = document.getElementById("clearBtn");
const printBtn = document.getElementById("printBtn");

let saveTimer = null;

async function loadDraft() {
  const draft = await getTriagemDraft();
  if (!draft || typeof draft !== "object") return false;
  restoreFormData(form, draft);
  return true;
}

async function saveDraft(data = collectFormData(form)) {
  try {
    await setTriagemDraft(data);
  } catch (error) {
    console.error("Falha ao salvar rascunho", error);
    showToast("Erro ao salvar rascunho localmente");
  }
}

function generateRecordId() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID();
  }
  return `record-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

async function loadCurrentFormState() {
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.has("new")) {
    await clearCurrentForm();
    return false;
  }

  const editingRecordId = getEditingRecordId();
  if (editingRecordId) {
    const records = await getAllRecords();
    const record = records.find((item) => item.id === editingRecordId);
    if (record && record.triagem) {
      restoreFormData(form, record.triagem);
      return true;
    }
    setEditingRecordId(null);
  }

  return loadDraft();
}

async function persistRecord() {
  const formData = collectFormData(form);
  const now = new Date().toISOString();
  const editingRecordId = getEditingRecordId();

  let record;
  let isUpdate = false;

  if (editingRecordId) {
    const records = await getAllRecords();
    const existingRecord = records.find((item) => item.id === editingRecordId);
    if (existingRecord) {
      isUpdate = true;
      record = { ...existingRecord, updatedAt: now, triagem: formData };
    }
  }

  if (!record) {
    record = {
      id: generateRecordId(),
      createdAt: now,
      updatedAt: now,
      triagem: formData,
      insercao: null,
    };
  }

  try {
    await putRecord(record);
    await saveDraft(formData);
  } catch (error) {
    console.error("Falha ao salvar triagem", error);
    showToast("Erro ao salvar triagem localmente");
    return;
  }

  setEditingRecordId(record.id);
  showToast(isUpdate ? "Triagem atualizada" : "Triagem salva");
  location.href = "records.html";
}

async function clearCurrentForm({ silent = false } = {}) {
  if (saveTimer) {
    window.clearTimeout(saveTimer);
    saveTimer = null;
  }

  form.reset();
  setEditingRecordId(null);
  await clearTriagemDraft();
  const url = new URL(window.location.href);
  url.search = "";
  window.history.replaceState({}, "", url.toString());
  if (!silent) {
    showToast("Formulário limpo");
  }
}

async function deleteRecordAfterPrint() {
  const editingRecordId = getEditingRecordId();

  try {
    if (editingRecordId) {
      await deleteRecordById(editingRecordId);
    }
    await clearCurrentForm({ silent: true });
    showToast("Prontuário excluído deste dispositivo");
  } catch (error) {
    console.error("Falha ao excluir prontuário após impressão", error);
    showToast("Erro ao excluir prontuário");
  }
}

function askToDeleteAfterPrint() {
  const confirmed = window.confirm(
    "Impressão concluída. Deseja excluir este prontuário deste dispositivo agora?"
  );
  if (confirmed) {
    deleteRecordAfterPrint();
  }
}

function watchPrintWindowForDeletePrompt(printWindow) {
  let prompted = false;
  let pollId = null;

  const triggerPrompt = () => {
    if (prompted) return;
    prompted = true;
    if (pollId) window.clearInterval(pollId);
    askToDeleteAfterPrint();
  };

  printWindow.addEventListener("afterprint", triggerPrompt);

  pollId = window.setInterval(() => {
    if (printWindow.closed) {
      triggerPrompt();
    }
  }, 500);
}

function scheduleAutoSave() {
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    saveDraft();
  }, 700);
}

function handlePrintAction() {
  try {
    const data = collectFormData(form);
    const bodyHtml = buildIdentificacaoHtml(data) + buildSubjetivoHtml(data);
    const printWindow = openPrintWindow(bodyHtml);

    if (printWindow) {
      watchPrintWindowForDeletePrompt(printWindow);
    } else {
      showToast("O bloqueador de pop-ups impediu a impressão.");
    }
  } catch (err) {
    console.error(err);
    showToast("Erro ao preparar impressão");
  }
}

form.addEventListener("input", scheduleAutoSave);
form.addEventListener("change", scheduleAutoSave);
form.addEventListener("submit", (event) => {
  event.preventDefault();
  persistRecord();
});

if (clearBtn) {
  clearBtn.addEventListener("click", () => {
    const confirmed = window.confirm("Deseja limpar o formulário e apagar o rascunho salvo?");
    if (confirmed) {
      clearCurrentForm();
    }
  });
}

if (printBtn) {
  printBtn.addEventListener("click", handlePrintAction);
}

window.addEventListener("beforeunload", () => {
  if (saveTimer) {
    window.clearTimeout(saveTimer);
    saveDraft();
  }
});

(async function init() {
  await runMigrations();
  await loadCurrentFormState();
  setupAutoCalculations(form);
  setupVisualMasks(form);
  registerServiceWorker();
})();
