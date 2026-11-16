import {
  getRecordById,
  putRecord,
  deleteRecordById,
  getInsercaoDraft,
  setInsercaoDraft,
  clearInsercaoDraft,
  getEditingRecordId,
  setEditingRecordId,
  requestPersistentStorage,
  runMigrations,
} from "./db.js";
import { showToast, setFlashMessage, getRecordDisplayName } from "./ui.js";
import {
  collectFormData,
  restoreFormData,
  normalizeTypedFields,
  setupAutoCalculations,
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
const saveBtn = document.getElementById("saveBtn");
const importBtn = document.getElementById("importBtn");
const importFile = document.getElementById("importFile");
const linkedTriagemNotice = document.getElementById("linkedTriagemNotice");

// Os campos de identificação ficam fora do <form> (não fazem parte dos dados clínicos da Inserção).
const identificationFields = {
  recordNumber: document.querySelector('[name="recordNumber"]'),
  patientName: document.querySelector('[name="patientName"]'),
  birthDate: document.querySelector('[name="birthDate"]'),
};

const NEW_MODE_TEXT = "Nova inserção (ainda não salva)";

let saving = false;
// Dados de Triagem vinculados a esta Inserção (vindos de um prontuário local ou de um JSON
// importado), usados para imprimir/salvar as duas etapas juntas. null = Inserção autônoma.
let linkedTriagemData = null;
// true quando o prontuário aberto já tem uma Triagem salva (não pode ser trocada por importação).
let recordHasTriagem = false;

function collectIdentificationData() {
  return normalizeTypedFields({
    recordNumber: identificationFields.recordNumber?.value ?? "",
    patientName: identificationFields.patientName?.value ?? "",
    birthDate: identificationFields.birthDate?.value ?? "",
  });
}

function restoreIdentificationData(data) {
  if (identificationFields.recordNumber) identificationFields.recordNumber.value = data?.recordNumber ?? "";
  if (identificationFields.patientName) identificationFields.patientName.value = data?.patientName ?? "";
  if (identificationFields.birthDate) identificationFields.birthDate.value = data?.birthDate ?? "";
}

function setLinkedTriagem(data) {
  linkedTriagemData = data ?? null;
  if (linkedTriagemNotice) linkedTriagemNotice.hidden = !linkedTriagemData;
}

// A identificação editada nesta página vale também para a Triagem vinculada, para que lista,
// impressão e exportações mostrem sempre os mesmos dados.
function mergeIdentificationIntoTriagem(triagem, identification) {
  return triagem ? { ...triagem, ...identification } : null;
}

// O rascunho guarda o id do prontuário em edição ("_recordId"), para que alterações não salvas
// de um prontuário já existente sejam retomadas no registro certo, sem criar duplicatas.
async function saveDraft() {
  const data = {
    ...collectFormData(form),
    ...collectIdentificationData(),
    _linkedTriagem: linkedTriagemData,
    _recordId: getEditingRecordId(),
  };
  try {
    await setInsercaoDraft(data);
    markDraftSaved();
  } catch (error) {
    console.error("Falha ao salvar rascunho", error);
    showToast("Erro ao salvar rascunho localmente");
  }
}

const autoSaver = createAutoSaver(saveDraft);

function describeDraft(draft) {
  const name = String(draft?.patientName ?? draft?._linkedTriagem?.patientName ?? "").trim();
  return name ? `de ${name}` : "sem nome informado";
}

function showRecord(record, draft) {
  setEditingRecordId(record.id);
  recordHasTriagem = Boolean(record.triagem);

  if (draft) {
    setLinkedTriagem(record.triagem ?? draft._linkedTriagem);
    restoreFormData(form, draft);
    restoreIdentificationData(draft);
  } else {
    setLinkedTriagem(record.triagem);
    if (record.insercao) restoreFormData(form, record.insercao);
    // A Triagem é a fonte da identificação quando existe.
    restoreIdentificationData(record.triagem ?? record.insercao);
  }

  const action = record.insercao ? "Editando inserção salva" : "Preenchendo inserção";
  setFormMode(`${action} de ${getRecordDisplayName(record)}` + (draft ? " (alterações não salvas recuperadas)" : ""));
}

async function loadCurrentFormState() {
  const draft = await getInsercaoDraft();
  const hasDraft = hasContent(draft);

  if (new URLSearchParams(window.location.search).has("new")) {
    removeNewParam();
    const discard =
      !hasDraft ||
      window.confirm(
        `Há uma inserção ${describeDraft(draft)} com preenchimento não salvo neste dispositivo.\n\n` +
          "Deseja descartá-lo e começar uma nova inserção?\n\nCancelar mantém o preenchimento atual."
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
    if (record) {
      const useDraft = hasDraft && draftRecordId === editingRecordId;

      if (hasDraft && !useDraft) {
        const discard = window.confirm(
          `Há uma inserção ${describeDraft(draft)} com preenchimento não salvo neste dispositivo.\n\n` +
            `Deseja descartá-lo para abrir a inserção de ${getRecordDisplayName(record)}?\n\n` +
            "Cancelar volta ao preenchimento não salvo."
        );
        if (discard) {
          await clearInsercaoDraft();
        } else {
          return restoreUnsavedDraft(draft);
        }
      }

      showRecord(record, useDraft ? draft : null);
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

  if (record) {
    showRecord(record, draft);
    return;
  }

  setEditingRecordId(null);
  recordHasTriagem = false;
  setLinkedTriagem(draft._linkedTriagem);
  restoreFormData(form, draft);
  restoreIdentificationData(draft);
  setFormMode(`${NEW_MODE_TEXT} — rascunho recuperado`);
}

async function persistRecord() {
  if (saving) return;
  if (!validateRequiredText(identificationFields.patientName, "Informe o nome da paciente.")) return;
  saving = true;
  if (saveBtn) saveBtn.disabled = true;
  autoSaver.cancel();

  try {
    const identification = collectIdentificationData();
    const formData = { ...collectFormData(form), ...identification };
    const now = new Date().toISOString();
    const editingRecordId = getEditingRecordId();
    const existingRecord = editingRecordId ? await getRecordById(editingRecordId) : null;

    let record;
    if (existingRecord) {
      record = {
        ...existingRecord,
        updatedAt: now,
        insercao: formData,
        triagem: mergeIdentificationIntoTriagem(existingRecord.triagem ?? linkedTriagemData, identification),
      };
    } else {
      record = {
        id: generateRecordId(),
        createdAt: now,
        updatedAt: now,
        triagem: mergeIdentificationIntoTriagem(linkedTriagemData, identification),
        insercao: formData,
      };
    }

    await putRecord(record);
    // O conteúdo já está no prontuário; o rascunho não é mais necessário.
    await clearInsercaoDraft();
    setEditingRecordId(null);
    requestPersistentStorage();
    setFlashMessage(existingRecord ? "Inserção atualizada" : "Inserção salva");
    window.location.href = "records.html";
  } catch (error) {
    console.error("Falha ao salvar inserção", error);
    showToast("Erro ao salvar inserção localmente");
    saving = false;
    if (saveBtn) saveBtn.disabled = false;
  }
}

async function resetForm() {
  autoSaver.cancel();
  form.reset();
  restoreIdentificationData({});
  setLinkedTriagem(null);
  recordHasTriagem = false;
  setEditingRecordId(null);
  await clearInsercaoDraft();
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
    const identification = collectIdentificationData();
    const insercaoData = { ...collectFormData(form), ...identification };
    const triagemData = mergeIdentificationIntoTriagem(linkedTriagemData, identification);

    const bodyHtml = triagemData
      ? buildIdentificacaoHtml(triagemData) +
        buildSubjetivoHtml(triagemData) +
        buildObjetivoHtml(insercaoData) +
        buildAvaliacaoHtml(insercaoData)
      : buildMiniIdentificacaoHtml(insercaoData) + buildObjetivoHtml(insercaoData) + buildAvaliacaoHtml(insercaoData);

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

async function handleImportFile(event) {
  const file = event.target.files[0];
  event.target.value = "";
  if (!file) return;

  try {
    const text = await file.text();
    const parsed = JSON.parse(text);
    const triagemData = parsed?.triagem;

    if (!triagemData || typeof triagemData !== "object" || Array.isArray(triagemData)) {
      showToast("Arquivo inválido: não contém dados de triagem");
      return;
    }

    if (linkedTriagemData || hasContent(collectIdentificationData())) {
      const confirmed = window.confirm(
        "A importação vai substituir a identificação preenchida e a triagem vinculada a esta inserção.\n\n" +
          "Deseja continuar?"
      );
      if (!confirmed) return;
    }

    setLinkedTriagem(triagemData);
    restoreIdentificationData(triagemData);
    await saveDraft();
    showToast("Dados da paciente importados");
  } catch (error) {
    console.error("Falha ao importar arquivo", error);
    showToast("Erro ao importar arquivo");
  }
}

form.addEventListener("input", autoSaver.schedule);
form.addEventListener("change", autoSaver.schedule);
form.addEventListener("submit", (event) => {
  event.preventDefault();
  persistRecord();
});

for (const field of Object.values(identificationFields)) {
  field?.addEventListener("input", autoSaver.schedule);
  field?.addEventListener("change", autoSaver.schedule);
}

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

if (importBtn && importFile) {
  importBtn.addEventListener("click", () => {
    if (recordHasTriagem) {
      showToast("Este prontuário já tem uma triagem salva neste dispositivo");
      return;
    }
    importFile.click();
  });
  importFile.addEventListener("change", handleImportFile);
}

setupDraftFlush(autoSaver);

(async function init() {
  await runMigrations();
  await loadCurrentFormState();
  setupAutoCalculations(form);
  setupRadioDeselect(form);
  registerServiceWorker();
})();
