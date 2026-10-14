import { getAllRecords, deleteRecordById, setEditingRecordId, runMigrations } from "./db.js";
import { formatDateOnly, getRecordDisplayName, getRecordNumber, showToast } from "./ui.js";
import { buildAnonymizedCsv, buildFormattedText, downloadFile } from "./export.js";

const recordsList = document.getElementById("recordsList");
const recordsEmpty = document.getElementById("recordsEmpty");
const recordsCount = document.getElementById("recordsCount");

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

function exportTriagemJson(record) {
  const payload = {
    exportedAt: new Date().toISOString(),
    triagem: record.triagem,
  };

  downloadFile(JSON.stringify(payload, null, 2), `triagem_${getPatientSlug(record)}.json`, "application/json");
  showToast("Dados da triagem exportados");
}

function exportRecordCsv(record) {
  // O nome do arquivo também não pode identificar a paciente.
  const fileId = getRecordNumber(record) || String(record.id ?? "").slice(0, 8) || "registro";
  downloadFile(buildAnonymizedCsv(record), `prontuario_${fileId}_anonimizado.csv`, "text/csv;charset=utf-8");
  showToast("CSV anonimizado exportado");
}

function exportRecordText(record) {
  downloadFile(buildFormattedText(record), `prontuario_${getPatientSlug(record)}.txt`, "text/plain;charset=utf-8");
  showToast("Texto formatado exportado");
}

async function deleteRecord(recordId) {
  const confirmed = window.confirm("Confirma exclusão deste prontuário (triagem e inserção)?");
  if (!confirmed) return;

  try {
    await deleteRecordById(recordId);
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

async function renderRecords() {
  let records = [];
  try {
    records = await getAllRecords();
  } catch (error) {
    console.error("Falha ao carregar prontuários", error);
    showToast("Erro ao carregar prontuários");
  }

  records = records.slice().sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  recordsCount.textContent = String(records.length);
  recordsEmpty.hidden = records.length > 0;
  recordsList.replaceChildren();

  for (const record of records) {
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
      createActionButton("Excluir", "primary danger", () => deleteRecord(record.id))
    );

    exportActions.append(
      createActionButton("Exportar CSV", "secondary", () => exportRecordCsv(record)),
      createActionButton("Exportar texto", "secondary", () => exportRecordText(record))
    );

    const actions = document.createElement("div");
    actions.className = "record-card-actions";
    actions.append(mainActions, exportActions);
    card.append(content, actions);
    recordsList.append(card);
  }
}

(async function init() {
  await runMigrations();
  await renderRecords();
})();

// Reatualiza a lista ao voltar para esta aba (ex.: após editar em outra aba)
window.addEventListener("focus", renderRecords);
