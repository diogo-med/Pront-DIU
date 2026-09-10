import { getAllRecords, deleteRecordById, setEditingRecordId, runMigrations } from "./db.js";
import { formatDateOnly, getRecordDisplayName, getRecordNumber, showToast } from "./ui.js";

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

function exportTriagemJson(record) {
  const payload = {
    exportedAt: new Date().toISOString(),
    triagem: record.triagem,
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const patientSlug = (record.triagem?.patientName || "paciente").trim().replace(/\s+/g, "_").toLowerCase();

  const link = document.createElement("a");
  link.href = url;
  link.download = `triagem_${patientSlug}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);

  showToast("Dados da triagem exportados");
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

    const actions = document.createElement("div");
    actions.className = "record-card-actions";

    if (record.triagem) {
      const editTriagemButton = document.createElement("button");
      editTriagemButton.type = "button";
      editTriagemButton.className = "secondary";
      editTriagemButton.textContent = "Editar Triagem";
      editTriagemButton.addEventListener("click", () => openTriagemForEdit(record.id));
      actions.append(editTriagemButton);

      const exportButton = document.createElement("button");
      exportButton.type = "button";
      exportButton.className = "secondary";
      exportButton.textContent = "Exportar JSON";
      exportButton.addEventListener("click", () => exportTriagemJson(record));
      actions.append(exportButton);
    }

    const insercaoButton = document.createElement("button");
    insercaoButton.type = "button";
    insercaoButton.className = "secondary";
    insercaoButton.textContent = record.insercao ? "Editar Inserção" : "Ir para Inserção";
    insercaoButton.addEventListener("click", () => openInsercaoForEdit(record.id));
    actions.append(insercaoButton);

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "secondary";
    deleteButton.textContent = "Excluir";
    deleteButton.addEventListener("click", () => deleteRecord(record.id));
    actions.append(deleteButton);

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
