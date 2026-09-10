import {
  getAllRecords,
  putRecord,
  deleteRecordById,
  getInsercaoDraft,
  setInsercaoDraft,
  clearInsercaoDraft,
  getEditingRecordId,
  setEditingRecordId,
  runMigrations,
} from "./db.js";
import { showToast } from "./ui.js";
import { collectFormData, restoreFormData, setupAutoCalculations, registerServiceWorker } from "./form-utils.js";
import {
  buildIdentificacaoHtml,
  buildMiniIdentificacaoHtml,
  buildSubjetivoHtml,
  buildObjetivoHtml,
  buildAvaliacaoHtml,
  openPrintWindow,
} from "./print.js";

const form = document.getElementById("diuForm");
const clearBtn = document.getElementById("clearBtn");
const printBtn = document.getElementById("printBtn");
const importBtn = document.getElementById("importBtn");
const importFile = document.getElementById("importFile");
const linkedTriagemNotice = document.getElementById("linkedTriagemNotice");

const identificationFields = {
  recordNumber: document.querySelector('[name="recordNumber"]'),
  patientName: document.querySelector('[name="patientName"]'),
  birthDate: document.querySelector('[name="birthDate"]'),
};

let saveTimer = null;
// Dados de Triagem vinculados a esta Inserção (vindos de um prontuário local ou de um JSON
// importado), usados para imprimir/salvar as duas etapas juntas. null = Inserção autônoma.
let linkedTriagemData = null;

function collectIdentificationData() {
  return {
    recordNumber: identificationFields.recordNumber?.value ?? "",
    patientName: identificationFields.patientName?.value ?? "",
    birthDate: identificationFields.birthDate?.value ?? "",
  };
}

function restoreIdentificationData(data) {
  if (identificationFields.recordNumber) identificationFields.recordNumber.value = data?.recordNumber ?? "";
  if (identificationFields.patientName) identificationFields.patientName.value = data?.patientName ?? "";
  if (identificationFields.birthDate) identificationFields.birthDate.value = data?.birthDate ?? "";
}

function updateLinkedNotice() {
  if (linkedTriagemNotice) linkedTriagemNotice.hidden = !linkedTriagemData;
}

async function loadDraft() {
  const draft = await getInsercaoDraft();
  if (!draft || typeof draft !== "object") return false;

  linkedTriagemData = draft._linkedTriagem ?? null;
  updateLinkedNotice();
  restoreFormData(form, draft);
  restoreIdentificationData(draft);
  return true;
}

async function saveDraft() {
  const data = { ...collectFormData(form), ...collectIdentificationData(), _linkedTriagem: linkedTriagemData };
  try {
    await setInsercaoDraft(data);
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
    if (record) {
      linkedTriagemData = record.triagem ?? null;
      updateLinkedNotice();
      if (record.insercao) {
        restoreFormData(form, record.insercao);
        restoreIdentificationData(record.insercao);
      } else if (linkedTriagemData) {
        restoreIdentificationData(linkedTriagemData);
      }
      return true;
    }
    setEditingRecordId(null);
  }

  return loadDraft();
}

async function persistRecord() {
  const formData = { ...collectFormData(form), ...collectIdentificationData() };
  const now = new Date().toISOString();
  const editingRecordId = getEditingRecordId();

  let record;
  let isUpdate = false;

  if (editingRecordId) {
    const records = await getAllRecords();
    const existingRecord = records.find((item) => item.id === editingRecordId);
    if (existingRecord) {
      isUpdate = true;
      record = {
        ...existingRecord,
        updatedAt: now,
        insercao: formData,
        triagem: existingRecord.triagem ?? linkedTriagemData ?? null,
      };
    }
  }

  if (!record) {
    record = {
      id: generateRecordId(),
      createdAt: now,
      updatedAt: now,
      triagem: linkedTriagemData,
      insercao: formData,
    };
  }

  try {
    await putRecord(record);
    await saveDraft();
  } catch (error) {
    console.error("Falha ao salvar inserção", error);
    showToast("Erro ao salvar inserção localmente");
    return;
  }

  setEditingRecordId(record.id);
  showToast(isUpdate ? "Inserção atualizada" : "Inserção salva");
  location.href = "records.html";
}

async function clearCurrentForm({ silent = false } = {}) {
  if (saveTimer) {
    window.clearTimeout(saveTimer);
    saveTimer = null;
  }

  form.reset();
  restoreIdentificationData({});
  linkedTriagemData = null;
  updateLinkedNotice();
  setEditingRecordId(null);
  await clearInsercaoDraft();
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
    "Impressão concluída. Deseja excluir este prontuário (triagem e inserção) deste dispositivo agora?"
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
    const insercaoData = { ...collectFormData(form), ...collectIdentificationData() };

    const bodyHtml = linkedTriagemData
      ? buildIdentificacaoHtml(linkedTriagemData) +
        buildSubjetivoHtml(linkedTriagemData) +
        buildObjetivoHtml(insercaoData) +
        buildAvaliacaoHtml(insercaoData)
      : buildMiniIdentificacaoHtml(insercaoData) + buildObjetivoHtml(insercaoData) + buildAvaliacaoHtml(insercaoData);

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

async function handleImportFile(event) {
  const file = event.target.files[0];
  event.target.value = "";
  if (!file) return;

  try {
    const text = await file.text();
    const parsed = JSON.parse(text);
    const triagemData = parsed?.triagem;

    if (!triagemData || typeof triagemData !== "object") {
      showToast("Arquivo inválido: não contém dados de triagem");
      return;
    }

    linkedTriagemData = triagemData;
    restoreIdentificationData(triagemData);
    updateLinkedNotice();
    await saveDraft();
    showToast("Dados da paciente importados");
  } catch (error) {
    console.error("Falha ao importar arquivo", error);
    showToast("Erro ao importar arquivo");
  }
}

form.addEventListener("input", scheduleAutoSave);
form.addEventListener("change", scheduleAutoSave);
form.addEventListener("submit", (event) => {
  event.preventDefault();
  persistRecord();
});

for (const field of Object.values(identificationFields)) {
  field?.addEventListener("input", scheduleAutoSave);
  field?.addEventListener("change", scheduleAutoSave);
}

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

if (importBtn && importFile) {
  importBtn.addEventListener("click", () => importFile.click());
  importFile.addEventListener("change", handleImportFile);
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
  registerServiceWorker();
})();
