// Lógica compartilhada entre as páginas de formulário (Triagem e Inserção).

export function generateRecordId() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID();
  }
  return `record-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

// Indica se há algo preenchido (ignora metadados como "_recordId").
export function hasContent(data) {
  if (!data || typeof data !== "object") return false;

  return Object.entries(data).some(([key, value]) => {
    if (key === "_recordId") return false;
    if (Array.isArray(value)) return value.length > 0;
    if (value && typeof value === "object") return hasContent(value);
    if (typeof value === "string") return value.trim() !== "";
    return Boolean(value);
  });
}

// Auto-salvamento com atraso: "schedule" a cada alteração, "flush" antes de sair da página.
export function createAutoSaver(save, delay = 700) {
  let timer = null;

  return {
    schedule() {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        timer = null;
        save();
      }, delay);
    },
    cancel() {
      window.clearTimeout(timer);
      timer = null;
    },
    async flush() {
      if (timer === null) return;
      window.clearTimeout(timer);
      timer = null;
      await save();
    },
  };
}

// Garante que o rascunho pendente seja gravado ao sair da página (inclusive no celular, onde
// "beforeunload" não é confiável) e antes de seguir os links do cabeçalho.
export function setupDraftFlush(autoSaver) {
  window.addEventListener("beforeunload", () => autoSaver.flush());
  window.addEventListener("pagehide", () => autoSaver.flush());
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") autoSaver.flush();
  });

  for (const link of document.querySelectorAll(".hero-actions a[href]")) {
    link.addEventListener("click", async (event) => {
      if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey) return;
      event.preventDefault();
      await autoSaver.flush();
      window.location.href = link.href;
    });
  }
}

// O atributo "required" aceita um nome só com espaços; esta checagem cobre esse caso e também
// campos que ficam fora do <form> (identificação da página de Inserção).
export function validateRequiredText(field, message) {
  if (!field) return true;
  field.setCustomValidity(field.value.trim() ? "" : message);
  field.addEventListener("input", () => field.setCustomValidity(""), { once: true });
  return field.reportValidity();
}

export function removeNewParam() {
  const url = new URL(window.location.href);
  url.search = "";
  window.history.replaceState({}, "", url.toString());
}

// Linha de status do cabeçalho: o que está sendo editado + horário do último rascunho salvo.
const statusElement = document.getElementById("formStatus");
let modeText = "";
let draftText = "";

function renderStatus() {
  if (!statusElement) return;
  statusElement.textContent = [modeText, draftText].filter(Boolean).join(" · ");
}

export function setFormMode(text) {
  modeText = text;
  renderStatus();
}

export function markDraftSaved() {
  const time = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(new Date());
  draftText = `Rascunho salvo às ${time}`;
  renderStatus();
}

export function clearDraftStatus() {
  draftText = "";
  renderStatus();
}

// Depois que a janela de impressão é usada/fechada, pergunta se o prontuário deve ser excluído.
// Não há como saber se a impressão foi concluída ou cancelada, então a pergunta não presume isso.
export function askToDeleteAfterPrint(printWindow, onConfirm) {
  let prompted = false;
  let pollId = null;

  const triggerPrompt = () => {
    if (prompted) return;
    prompted = true;
    if (pollId) window.clearInterval(pollId);

    const confirmed = window.confirm(
      "A janela de impressão foi fechada.\n\n" +
        "Se o prontuário já foi impresso ou salvo em PDF, deseja excluí-lo deste dispositivo agora? " +
        "Isso apaga a triagem e a inserção desta paciente.\n\n" +
        "Se a impressão foi cancelada, escolha Cancelar para manter o prontuário."
    );
    if (confirmed) onConfirm();
  };

  printWindow.addEventListener("afterprint", triggerPrompt);

  pollId = window.setInterval(() => {
    if (printWindow.closed) triggerPrompt();
  }, 500);
}
