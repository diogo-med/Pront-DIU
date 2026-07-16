const RECORDS_KEY = "prontdiu.records.v1";
const EDITING_RECORD_KEY = "prontdiu.editingRecordId.v1";

const recordsList = document.getElementById("recordsList");
const recordsEmpty = document.getElementById("recordsEmpty");
const recordsCount = document.getElementById("recordsCount");
const toastTemplate = document.getElementById("toastTemplate");

function readJSON(key, fallback) {
  const raw = localStorage.getItem(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw);
  } catch (e) {
    console.error(`Falha ao ler ${key}`, e);
    return fallback;
  }
}

function writeJSON(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function showToast(message) {
  const toast = toastTemplate.content.firstElementChild.cloneNode(true);
  toast.textContent = message;
  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add("show"));
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 200);
  }, 2200);
}

function loadRecords() {
  const records = readJSON(RECORDS_KEY, []);
  return Array.isArray(records) ? records : [];
}

function saveRecords(records) {
  writeJSON(RECORDS_KEY, records);
}

function formatDateOnly(isoString) {
  if (!isoString) return "Sem data";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium" }).format(new Date(isoString));
}

function getRecordDisplayName(record) {
  const rawName = record?.data?.patientName?.trim();
  return rawName || "Nome não informado";
}

function openRecordForEdit(recordId) {
  sessionStorage.setItem(EDITING_RECORD_KEY, recordId);
  window.location.href = "index.html";
}

function deleteRecord(recordId) {
  const confirmed = window.confirm("Confirma exclusão deste prontuário?");
  if (!confirmed) return;
  const records = loadRecords();
  const remaining = records.filter((r) => r.id !== recordId);
  saveRecords(remaining);
  renderRecords();
  showToast("Prontuário excluído");
}

function renderRecords() {
  const records = loadRecords().slice().sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
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
    meta.textContent = `Criado em ${formatDateOnly(record.createdAt)}`;

    const secondary = document.createElement("p");
    secondary.className = "record-card-secondary";
    const recordNumber = record?.data?.recordNumber?.trim();
    secondary.textContent = recordNumber ? `Prontuário ${recordNumber}` : "Sem número de prontuário informado";

    content.append(title, secondary, meta);

    const actions = document.createElement("div");
    actions.className = "record-card-actions";

    const editButton = document.createElement("button");
    editButton.type = "button";
    editButton.className = "secondary";
    editButton.textContent = "Editar";
    editButton.addEventListener("click", () => openRecordForEdit(record.id));

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "secondary";
    deleteButton.textContent = "Excluir";
    deleteButton.addEventListener("click", () => deleteRecord(record.id));

    actions.append(editButton, deleteButton);
    card.append(content, actions);
    recordsList.append(card);
  }
}

renderRecords();

// Re-render when records change in another window/tab
window.addEventListener("storage", (e) => {
  if (e.key === RECORDS_KEY) {
    renderRecords();
  }
});
