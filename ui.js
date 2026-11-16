export function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function formatDateOnly(isoString) {
  if (!isoString) return "Sem data";
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(isoString));
}

export function formatDateTime(isoString) {
  if (!isoString) return "Sem data";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(isoString));
}

export function getRecordDisplayName(record) {
  const rawName = String(record?.triagem?.patientName ?? record?.insercao?.patientName ?? "").trim();
  return rawName || "Nome não informado";
}

export function getRecordNumber(record) {
  return String(record?.triagem?.recordNumber ?? record?.insercao?.recordNumber ?? "").trim();
}

let toastTimer = null;

export function showToast(message) {
  const template = document.getElementById("toastTemplate");
  if (!template) return;

  const toast = template.content.firstElementChild.cloneNode(true);
  toast.textContent = message;
  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add("show"));

  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    toast.classList.remove("show");
    window.setTimeout(() => toast.remove(), 200);
  }, 2200);
}

const FLASH_MESSAGE_KEY = "prontdiu.flashMessage.v1";

// Mensagem a ser exibida na próxima página (ex.: "Triagem salva" depois do redirecionamento).
export function setFlashMessage(message) {
  sessionStorage.setItem(FLASH_MESSAGE_KEY, message);
}

export function showFlashMessage() {
  const message = sessionStorage.getItem(FLASH_MESSAGE_KEY);
  if (!message) return;
  sessionStorage.removeItem(FLASH_MESSAGE_KEY);
  showToast(message);
}
