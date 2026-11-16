import { getAllRecords, putRecords, deleteRecordById, setEditingRecordId, runMigrations } from "./db.js";
import { formatDateOnly, getRecordDisplayName, getRecordNumber, showToast, showFlashMessage } from "./ui.js";
import { buildAnonymizedCsv, buildFormattedText, buildBackupJson, saveFile } from "./export.js";

const recordsList = document.getElementById("recordsList");
const recordsEmpty = document.getElementById("recordsEmpty");
const recordsCount = document.getElementById("recordsCount");
const searchInput = document.getElementById("recordsSearch");
const exportAllCsvBtn = document.getElementById("exportAllCsvBtn");
const backupBtn = document.getElementById("backupBtn");
const restoreBtn = document.getElementById("restoreBtn");
const restoreFile = document.getElementById("restoreFile");

let allRecords = [];

function openTriagemForEdit(recordId) {
  setEditingRecordId(recordId);
  window.location.href = "index.html";
}

function openInsercaoForEdit(recordId) {
  setEditingRecordId(recordId);
  window.location.href = "insercao.html";
}

function getPatientSlug(record) {
  return (getRecordDisplayName(record) === "Nome não informado" ? "paciente" : getRecordDisplayName(record))
    .replace(/\s+/g, "_")
    .toLowerCase();
}

function todayStamp() {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

// Busca sem diferenciar maiúsculas/minúsculas nem acentos.
function normalizeSearchText(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

async function exportFile(content, filename, mimeType, successMessage) {
  try {
    const saved = await saveFile(content, filename, mimeType);
    if (saved) showToast(successMessage);
  } catch (error) {
    console.error("Falha ao exportar arquivo", error);
    showToast("Erro ao exportar arquivo");
  }
}

function exportTriagemJson(record) {
  const payload = {
    exportedAt: new Date().toISOString(),
    triagem: record.triagem,
  };

  return exportFile(
    JSON.stringify(payload, null, 2),
    `triagem_${getPatientSlug(record)}.json`,
    "application/json",
    "Dados da triagem exportados"
  );
}

function exportRecordCsv(record) {
  // O número do prontuário pode ter letras e símbolos; no nome do arquivo ficam só letras, números, "-" e "_".
  const safeNumber = getRecordNumber(record).replace(/[^\p{L}\p{N}_-]+/gu, "_");
  const fileId = safeNumber || String(record.id ?? "").slice(0, 8) || "registro";
  return exportFile(
    buildAnonymizedCsv([record]),
    `prontuario_${fileId}_anonimizado.csv`,
    "text/csv;charset=utf-8",
    "CSV exportado"
  );
}

function exportRecordText(record) {
  return exportFile(
    buildFormattedText(record),
    `prontuario_${getPatientSlug(record)}.txt`,
    "text/plain;charset=utf-8",
    "Texto formatado exportado"
  );
}

function exportAllCsv() {
  if (allRecords.length === 0) {
    showToast("Não há prontuários para exportar");
    return;
  }
  // Do mais antigo para o mais novo, como em uma planilha de acompanhamento.
  const ordered = allRecords.slice().reverse();
  return exportFile(
    buildAnonymizedCsv(ordered, { includeHeader: true }),
    `prontuarios_${todayStamp()}_anonimizado.csv`,
    "text/csv;charset=utf-8",
    `CSV com ${ordered.length} prontuário(s) exportado`
  );
}

function exportBackup() {
  if (allRecords.length === 0) {
    showToast("Não há prontuários para incluir no backup");
    return;
  }
  return exportFile(
    buildBackupJson(allRecords),
    `prontdiu_backup_${todayStamp()}.json`,
    "application/json",
    `Backup com ${allRecords.length} prontuário(s) salvo`
  );
}

function isValidBackupRecord(record) {
  const isSection = (value) => value === null || value === undefined || (typeof value === "object" && !Array.isArray(value));
  return (
    record &&
    typeof record === "object" &&
    typeof record.id === "string" &&
    record.id !== "" &&
    isSection(record.triagem) &&
    isSection(record.insercao) &&
    Boolean(record.triagem || record.insercao)
  );
}

async function handleRestoreFile(event) {
  const file = event.target.files[0];
  event.target.value = "";
  if (!file) return;

  try {
    const parsed = JSON.parse(await file.text());
    const backupRecords = Array.isArray(parsed?.records) ? parsed.records.filter(isValidBackupRecord) : [];

    if (backupRecords.length === 0) {
      showToast("Arquivo inválido: não é um backup do ProntDIU");
      return;
    }

    const existingIds = new Set((await getAllRecords()).map((record) => record.id));
    const newRecords = backupRecords.filter((record) => !existingIds.has(record.id));
    const conflicting = backupRecords.filter((record) => existingIds.has(record.id));

    let toImport = newRecords;
    if (conflicting.length > 0) {
      const replace = window.confirm(
        `${conflicting.length} prontuário(s) do backup já existem neste dispositivo.\n\n` +
          "Deseja substituí-los pela versão do backup? As versões atuais deles serão apagadas.\n\n" +
          "Cancelar mantém as versões atuais e importa apenas os prontuários novos."
      );
      if (replace) toImport = backupRecords;
    }

    if (toImport.length === 0) {
      showToast("Nenhum prontuário novo no backup");
      return;
    }

    await putRecords(toImport);
    await renderRecords();
    showToast(`${toImport.length} prontuário(s) restaurado(s) do backup`);
  } catch (error) {
    console.error("Falha ao restaurar backup", error);
    showToast("Erro ao restaurar backup");
  }
}

async function deleteRecord(record) {
  const confirmed = window.confirm(
    `Confirma a exclusão do prontuário de ${getRecordDisplayName(record)} (triagem e inserção)?\n\n` +
      "Essa ação não pode ser desfeita."
  );
  if (!confirmed) return;

  try {
    await deleteRecordById(record.id);
  } catch (error) {
    console.error("Falha ao excluir prontuário", error);
    showToast("Erro ao excluir prontuário");
    return;
  }

  await renderRecords();
  showToast("Prontuário excluído");
}

function createActionButton(label, className, onClick) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = className;
  button.textContent = label;
  button.addEventListener("click", onClick);
  return button;
}

function getStatusLabel(record) {
  const hasTriagem = Boolean(record.triagem);
  const hasInsercao = Boolean(record.insercao);
  if (hasTriagem && hasInsercao) return "Triagem + Inserção";
  if (hasTriagem) return "Somente Triagem";
  if (hasInsercao) return "Somente Inserção";
  return "Vazio";
}

function createRecordCard(record) {
  const card = document.createElement("article");
  card.className = "record-card";

  const content = document.createElement("div");
  content.className = "record-card-content";

  const title = document.createElement("h3");
  title.textContent = getRecordDisplayName(record);

  const meta = document.createElement("p");
  meta.className = "record-card-meta";
  meta.textContent = `Criado em ${formatDateOnly(record.createdAt)} — ${getStatusLabel(record)}`;

  const secondary = document.createElement("p");
  secondary.className = "record-card-secondary";
  const recordNumber = getRecordNumber(record);
  secondary.textContent = recordNumber ? `Prontuário ${recordNumber}` : "Sem número de prontuário informado";

  content.append(title, secondary, meta);

  const mainActions = document.createElement("div");
  mainActions.className = "record-card-actions-row";

  const exportActions = document.createElement("div");
  exportActions.className = "record-card-actions-row";

  if (record.triagem) {
    mainActions.append(createActionButton("Editar Triagem", "primary", () => openTriagemForEdit(record.id)));
    exportActions.append(createActionButton("Exportar JSON", "secondary", () => exportTriagemJson(record)));
  }

  mainActions.append(
    createActionButton(record.insercao ? "Editar Inserção" : "Ir para Inserção", "primary", () =>
      openInsercaoForEdit(record.id)
    ),
    createActionButton("Excluir", "primary danger", () => deleteRecord(record))
  );

  exportActions.append(
    createActionButton("Exportar CSV", "secondary", () => exportRecordCsv(record)),
    createActionButton("Exportar texto", "secondary", () => exportRecordText(record))
  );

  const actions = document.createElement("div");
  actions.className = "record-card-actions";
  actions.append(mainActions, exportActions);
  card.append(content, actions);
  return card;
}

function renderList() {
  const query = normalizeSearchText(searchInput?.value);
  const visible = query
    ? allRecords.filter(
        (record) =>
          normalizeSearchText(getRecordDisplayName(record)).includes(query) ||
          normalizeSearchText(getRecordNumber(record)).includes(query)
      )
    : allRecords;

  recordsCount.textContent = String(allRecords.length);
  recordsList.replaceChildren(...visible.map(createRecordCard));

  recordsEmpty.hidden = visible.length > 0;
  if (visible.length === 0) {
    const [title, detail] = recordsEmpty.children;
    title.textContent = allRecords.length === 0 ? "Nenhum prontuário salvo." : "Nenhum prontuário encontrado.";
    detail.textContent =
      allRecords.length === 0
        ? "Use “Nova Triagem” ou “Nova Inserção” para começar."
        : "Confira o nome ou o número digitado na busca.";
  }
}

async function renderRecords() {
  try {
    const records = await getAllRecords();
    const createdTime = (record) => new Date(record.createdAt).getTime() || 0;
    allRecords = records.slice().sort((a, b) => createdTime(b) - createdTime(a));
  } catch (error) {
    console.error("Falha ao carregar prontuários", error);
    showToast("Erro ao carregar prontuários");
  }

  renderList();
}

searchInput?.addEventListener("input", renderList);
exportAllCsvBtn?.addEventListener("click", exportAllCsv);
backupBtn?.addEventListener("click", exportBackup);
if (restoreBtn && restoreFile) {
  restoreBtn.addEventListener("click", () => restoreFile.click());
  restoreFile.addEventListener("change", handleRestoreFile);
}

(async function init() {
  await runMigrations();
  await renderRecords();
  showFlashMessage();
})();

// Reatualiza a lista ao voltar para esta aba (ex.: após editar em outra aba)
window.addEventListener("focus", renderRecords);
