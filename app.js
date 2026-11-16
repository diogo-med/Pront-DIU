import {
  getRecordById,
  putRecord,
  deleteRecordById,
  getTriagemDraft,
  setTriagemDraft,
  clearTriagemDraft,
  getEditingRecordId,
  setEditingRecordId,
  requestPersistentStorage,
  runMigrations,
} from "./db.js";
import { showToast, setFlashMessage, getRecordDisplayName } from "./ui.js";
import {
  collectFormData,
  restoreFormData,
  setupAutoCalculations,
  setupVisualMasks,
  setupRadioDeselect,
  registerServiceWorker,
} from "./form-utils.js";
import {
  generateRecordId,
  hasContent,
  createAutoSaver,
  setupDraftFlush,
  removeNewParam,
  validateRequiredText,
  setFormMode,
  markDraftSaved,
  clearDraftStatus,
  askToDeleteAfterPrint,
} from "./form-page.js";
import { buildIdentificacaoHtml, buildSubjetivoHtml, openPrintWindow } from "./print.js";

const form = document.getElementById("diuForm");
const clearBtn = document.getElementById("clearBtn");
const printBtn = document.getElementById("printBtn");
const saveBtn = document.getElementById("saveBtn");

const NEW_MODE_TEXT = "Nova triagem (ainda não salva)";

let saving = false;

// O rascunho guarda o id do prontuário em edição ("_recordId"), para que alterações não salvas
// de um prontuário já existente sejam retomadas no registro certo, sem criar duplicatas.
async function saveDraft() {
  try {
    await setTriagemDraft({ ...collectFormData(form), _recordId: getEditingRecordId() });
    markDraftSaved();
  } catch (error) {
    console.error("Falha ao salvar rascunho", error);
    showToast("Erro ao salvar rascunho localmente");
  }
}

const autoSaver = createAutoSaver(saveDraft);

function describeDraft(draft) {
  const name = String(draft?.patientName ?? "").trim();
  return name ? `de ${name}` : "sem nome informado";
}

async function loadCurrentFormState() {
  const draft = await getTriagemDraft();
  const hasDraft = hasContent(draft);

  if (new URLSearchParams(window.location.search).has("new")) {
    removeNewParam();
    const discard =
      !hasDraft ||
      window.confirm(
        `Há uma triagem ${describeDraft(draft)} com preenchimento não salvo neste dispositivo.\n\n` +
          "Deseja descartá-lo e começar uma nova triagem?\n\nCancelar mantém o preenchimento atual."
      );
    if (discard) {
      await resetForm();
      return;
    }
  }

  const draftRecordId = hasDraft ? draft._recordId ?? null : null;
  let editingRecordId = getEditingRecordId();
  // Sem prontuário aberto nesta sessão, retoma o prontuário ao qual o rascunho pertence.
  if (!editingRecordId && draftRecordId) editingRecordId = draftRecordId;

  if (editingRecordId) {
    const record = await getRecordById(editingRecordId);
    if (record && record.triagem) {
      let useDraft = hasDraft && draftRecordId === editingRecordId;

      if (hasDraft && !useDraft) {
        const discard = window.confirm(
          `Há uma triagem ${describeDraft(draft)} com preenchimento não salvo neste dispositivo.\n\n` +
            `Deseja descartá-lo para abrir a triagem de ${getRecordDisplayName(record)}?\n\n` +
            "Cancelar volta ao preenchimento não salvo."
        );
        if (discard) {
          await clearTriagemDraft();
        } else {
          return restoreUnsavedDraft(draft);
        }
      }

      setEditingRecordId(record.id);
      restoreFormData(form, useDraft ? draft : record.triagem);
      setFormMode(
        `Editando triagem salva de ${getRecordDisplayName(record)}` +
          (useDraft ? " (alterações não salvas recuperadas)" : "")
      );
      return;
    }
    setEditingRecordId(null);
  }

  if (hasDraft) {
    await restoreUnsavedDraft(draft);
    return;
  }

  setFormMode(NEW_MODE_TEXT);
}

// Restaura um rascunho que não corresponde ao prontuário aberto nesta sessão.
async function restoreUnsavedDraft(draft) {
  const draftRecordId = draft._recordId ?? null;
  const record = draftRecordId ? await getRecordById(draftRecordId) : null;

  restoreFormData(form, draft);

  if (record && record.triagem) {
    setEditingRecordId(record.id);
    setFormMode(`Editando triagem salva de ${getRecordDisplayName(record)} (alterações não salvas recuperadas)`);
  } else {
    setEditingRecordId(null);
    setFormMode(`${NEW_MODE_TEXT} — rascunho recuperado`);
  }
}

async function persistRecord() {
  if (saving) return;
  if (!validateRequiredText(form.querySelector('[name="patientName"]'), "Informe o nome da paciente.")) return;
  saving = true;
  if (saveBtn) saveBtn.disabled = true;
  autoSaver.cancel();

  try {
    const formData = collectFormData(form);
    const now = new Date().toISOString();
    const editingRecordId = getEditingRecordId();
    const existingRecord = editingRecordId ? await getRecordById(editingRecordId) : null;

    let record;
    if (existingRecord) {
      record = { ...existingRecord, updatedAt: now, triagem: formData };
      // Mantém a identificação gravada na Inserção igual à da Triagem.
      if (existingRecord.insercao) {
        record.insercao = {
          ...existingRecord.insercao,
          recordNumber: formData.recordNumber,
          patientName: formData.patientName,
          birthDate: formData.birthDate,
        };
      }
    } else {
      record = {
        id: generateRecordId(),
        createdAt: now,
        updatedAt: now,
        triagem: formData,
        insercao: null,
      };
    }

    await putRecord(record);
    // O conteúdo já está no prontuário; o rascunho não é mais necessário.
    await clearTriagemDraft();
    setEditingRecordId(null);
    requestPersistentStorage();
    setFlashMessage(existingRecord ? "Triagem atualizada" : "Triagem salva");
    window.location.href = "records.html";
  } catch (error) {
    console.error("Falha ao salvar triagem", error);
    showToast("Erro ao salvar triagem localmente");
    saving = false;
    if (saveBtn) saveBtn.disabled = false;
  }
}

async function resetForm() {
  autoSaver.cancel();
  form.reset();
  setEditingRecordId(null);
  await clearTriagemDraft();
  clearDraftStatus();
  setFormMode(NEW_MODE_TEXT);
}

async function deleteRecordAfterPrint() {
  const editingRecordId = getEditingRecordId();

  try {
    if (editingRecordId) {
      await deleteRecordById(editingRecordId);
    }
    await resetForm();
    showToast("Prontuário excluído deste dispositivo");
  } catch (error) {
    console.error("Falha ao excluir prontuário após impressão", error);
    showToast("Erro ao excluir prontuário");
  }
}

function handlePrintAction() {
  try {
    const data = collectFormData(form);
    const bodyHtml = buildIdentificacaoHtml(data) + buildSubjetivoHtml(data);
    const printWindow = openPrintWindow(bodyHtml);

    if (printWindow) {
      askToDeleteAfterPrint(printWindow, deleteRecordAfterPrint);
    } else {
      showToast("O bloqueador de pop-ups impediu a impressão.");
    }
  } catch (err) {
    console.error(err);
    showToast("Erro ao preparar impressão");
  }
}

form.addEventListener("input", autoSaver.schedule);
form.addEventListener("change", autoSaver.schedule);
form.addEventListener("submit", (event) => {
  event.preventDefault();
  persistRecord();
});

if (clearBtn) {
  clearBtn.addEventListener("click", async () => {
    const confirmed = window.confirm(
      "Deseja limpar o formulário e apagar o rascunho salvo?" +
        (getEditingRecordId() ? "\n\nO prontuário já salvo não será excluído." : "")
    );
    if (confirmed) {
      await resetForm();
      showToast("Formulário limpo");
    }
  });
}

if (printBtn) {
  printBtn.addEventListener("click", handlePrintAction);
}

setupDraftFlush(autoSaver);

(async function init() {
  await runMigrations();
  await loadCurrentFormState();
  setupAutoCalculations(form);
  setupVisualMasks(form);
  setupRadioDeselect(form);
  registerServiceWorker();
})();
