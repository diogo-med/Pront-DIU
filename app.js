const FORM_DRAFT_KEY = "prontdiu.form.v1";
const RECORDS_KEY = "prontdiu.records.v1";
const EDITING_RECORD_KEY = "prontdiu.editingRecordId.v1";

const form = document.getElementById("diuForm");
const clearBtn = document.getElementById("clearBtn");
const newRecordBtn = document.getElementById("newRecordBtn");
const printBtn = document.getElementById("printBtn");
const formView = document.getElementById("formView");
const toastTemplate = document.getElementById("toastTemplate");

let saveTimer = null;
let toastTimer = null;
let currentView = "form";

window.prontDiuApp = {
  clearForm: (event) => {
    event?.preventDefault?.();
    clearCurrentForm();
  },
  saveRecord: (event) => {
    event?.preventDefault?.();
    persistRecord({ redirectToRecords: true });
  },
  printForm: (event) => {
    event?.preventDefault?.();
    handlePrintAction();
  },
};

function getFieldValue(field) {
  if (field.type === "checkbox") {
    return field.checked;
  }

  if (field.type === "radio") {
    if (!field.checked) return null;
    return field.value;
  }

  return field.value;
}

function setFieldValue(field, value) {
  if (field.type === "checkbox") {
    field.checked = Boolean(value);
    return;
  }

  if (field.type === "radio") {
    field.checked = field.value === value;
    return;
  }

  field.value = value ?? "";
}

function sanitizeInteger(value) {
  if (value === null || value === undefined || value === "") return "";
  const digitsOnly = String(value).replace(/\D/g, "");
  return digitsOnly;
}

function formatCpf(value) {
  const digits = sanitizeInteger(value).slice(0, 11);
  if (!digits) return "";

  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

function formatPhone(value) {
  const digits = sanitizeInteger(value).slice(0, 11);
  if (!digits) return "";

  if (digits.length < 3) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

function normalizeTypedFields(data) {
  const normalized = { ...data };

  normalized.recordNumber = sanitizeInteger(normalized.recordNumber);
  normalized.rg = sanitizeInteger(normalized.rg);
  normalized.cpf = sanitizeInteger(normalized.cpf);
  normalized.cns = sanitizeInteger(normalized.cns);
  normalized.phone = sanitizeInteger(normalized.phone);

  normalized.patientName = String(normalized.patientName ?? "").trim();

  return normalized;
}

function collectFormData() {
  const data = {};
  const elements = Array.from(form.elements);

  for (const field of elements) {
    if (!field.name || field.disabled) continue;

    if (field.type === "checkbox" && field.name in data) {
      if (!Array.isArray(data[field.name])) {
        data[field.name] = [];
      }
      if (field.checked) {
        data[field.name].push(field.value || true);
      }
      continue;
    }

    if (field.type === "checkbox") {
      data[field.name] = field.checked;
      continue;
    }

    if (field.type === "radio") {
      if (field.checked) {
        data[field.name] = field.value;
      } else if (!(field.name in data)) {
        data[field.name] = "";
      }
      continue;
    }

    data[field.name] = getFieldValue(field);
  }

  const multiValues = {};
  const checkboxGroups = new Set();

  for (const field of elements) {
    if (!field.name || field.type !== "checkbox") continue;
    if (!checkboxGroups.has(field.name)) {
      checkboxGroups.add(field.name);
      const group = elements.filter((candidate) => candidate.name === field.name && candidate.type === "checkbox");
      if (group.length > 1) {
        multiValues[field.name] = group.filter((candidate) => candidate.checked).map((candidate) => candidate.value || true);
      }
    }
  }

  return normalizeTypedFields({ ...data, ...multiValues });
}

function restoreFormData(data) {
  const normalizedData = normalizeTypedFields(data);
  const elements = Array.from(form.elements);
  const handledCheckboxGroups = new Set();

  for (const field of elements) {
    if (!field.name || field.disabled || !(field.name in normalizedData)) continue;

    if (field.type === "checkbox") {
      const group = elements.filter((candidate) => candidate.name === field.name && candidate.type === "checkbox");
      if (group.length > 1) {
        if (handledCheckboxGroups.has(field.name)) continue;
        const values = Array.isArray(normalizedData[field.name]) ? normalizedData[field.name] : [];
        for (const checkbox of group) {
          checkbox.checked = values.includes(checkbox.value || true);
        }
        handledCheckboxGroups.add(field.name);
      } else {
        field.checked = Boolean(normalizedData[field.name]);
      }
      continue;
    }

    if (field.type === "radio") {
      field.checked = field.value === normalizedData[field.name];
      continue;
    }

    setFieldValue(field, normalizedData[field.name]);
  }
}

function showToast(message) {
  const toast = toastTemplate.content.firstElementChild.cloneNode(true);
  toast.textContent = message;
  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add("show"));

  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    toast.classList.remove("show");
    window.setTimeout(() => toast.remove(), 200);
  }, 2200);
}

function readJSON(key, fallback) {
  const raw = localStorage.getItem(key);
  if (!raw) return fallback;

  try {
    return JSON.parse(raw);
  } catch (error) {
    console.error(`Falha ao ler ${key}`, error);
    return fallback;
  }
}

function writeJSON(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function loadDraft() {
  const draft = readJSON(FORM_DRAFT_KEY, null);
  if (!draft || typeof draft !== "object") return false;
  restoreFormData(draft);
  return true;
}

function saveDraft(data = collectFormData()) {
  writeJSON(FORM_DRAFT_KEY, data);
}

function clearDraft() {
  localStorage.removeItem(FORM_DRAFT_KEY);
}

function loadRecords() {
  const records = readJSON(RECORDS_KEY, []);
  return Array.isArray(records) ? records : [];
}

function saveRecords(records) {
  writeJSON(RECORDS_KEY, records);
}

function getEditingRecordId() {
  return sessionStorage.getItem(EDITING_RECORD_KEY);
}

function setEditingRecordId(recordId) {
  if (!recordId) {
    sessionStorage.removeItem(EDITING_RECORD_KEY);
    return;
  }

  sessionStorage.setItem(EDITING_RECORD_KEY, recordId);
}

function generateRecordId() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID();
  }

  return `record-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function formatDateTime(isoString) {
  if (!isoString) return "Sem data";

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(isoString));
}

function formatDateOnly(isoString) {
  if (!isoString) return "Sem data";

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "medium",
  }).format(new Date(isoString));
}

function getRecordDisplayName(record) {
  const rawName = record?.data?.patientName?.trim();
  return rawName || "Nome não informado";
}

function loadCurrentFormState() {
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.has('new')) {
    clearCurrentForm();
    return false;
  }

  const editingRecordId = getEditingRecordId();
  if (editingRecordId) {
    const record = loadRecords().find((item) => item.id === editingRecordId);
    if (record) {
      restoreFormData(record.data);
      return true;
    }
    setEditingRecordId(null);
  }

  return loadDraft();
}

function persistRecord({ clearAfterSave = false, redirectToRecords = false } = {}) {
  const formData = collectFormData();
  const now = new Date().toISOString();
  const editingRecordId = getEditingRecordId();
  const records = loadRecords();
  const existingIndex = editingRecordId ? records.findIndex((record) => record.id === editingRecordId) : -1;
  let savedRecordId = editingRecordId;

  if (existingIndex >= 0) {
    const existingRecord = records[existingIndex];
    savedRecordId = existingRecord.id;
    records[existingIndex] = {
      ...existingRecord,
      updatedAt: now,
      data: formData,
    };
  } else {
    const newRecord = {
      id: generateRecordId(),
      createdAt: now,
      updatedAt: now,
      data: formData,
    };
    records.push(newRecord);
    savedRecordId = newRecord.id;
  }

  saveRecords(records);
  saveDraft(formData);
  if (!clearAfterSave) {
    setEditingRecordId(savedRecordId);
  }
  showToast(existingIndex >= 0 ? "Prontuário atualizado" : "Prontuário salvo");


  if (clearAfterSave) {
    clearCurrentForm();
  }

  if (redirectToRecords) {
    // redireciona para a página dedicada de lista de prontuários
    location.href = "records.html";
  }
}

function clearCurrentForm() {
  if (saveTimer) {
    window.clearTimeout(saveTimer);
    saveTimer = null;
  }

  form.reset();
  setEditingRecordId(null);
  clearDraft();
  const url = new URL(window.location.href);
  url.search = "";
  window.history.replaceState({}, "", url.toString());
  showToast("Formulário limpo");
}

function openRecordForEdit(recordId) {
  const record = loadRecords().find((item) => item.id === recordId);
  if (!record) {
    showToast("Prontuário não encontrado");
    return;
  }

  setEditingRecordId(recordId);
  restoreFormData(record.data);
  saveDraft(record.data);
  openFormView();
  window.scrollTo({ top: 0, behavior: "smooth" });
  showToast(`Prontuário de ${getRecordDisplayName(record)} aberto para edição`);
}

function handleNewRecordAction() {
  clearCurrentForm();
}

function scheduleAutoSave() {
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    saveDraft();
  }, 700);
}

function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js")
      .then((registration) => {
        // Se houver uma atualização pendente e o navegador achar um sw novo
        registration.addEventListener("updatefound", () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener("statechange", () => {
              // Quando o novo SW terminar de instalar e for ativado
              if (newWorker.state === "activated") {
                console.log("Nova versão detectada! Recarregando...");
                window.location.reload(); // Recarrega para aplicar a atualização
              }
            });
          }
        });
      })
      .catch((error) => {
        console.warn("Service worker não registrado", error);
      });

    // Garante o recarregamento caso o SW mude em outra aba ativa
    let refreshing = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (!refreshing) {
        refreshing = true;
        window.location.reload();
      }
    });
  }
}

function calculateBMI() {
  const weightField = form.querySelector('[name="weight"]');
  const heightField = form.querySelector('[name="height"]');
  const bmiField = form.querySelector('[name="bmi"]');

  if (!weightField || !heightField || !bmiField) return;

  const weight = parseFloat(String(weightField.value).replace(",", "."));
  const heightCm = parseFloat(String(heightField.value).replace(",", "."));

  if (!Number.isFinite(weight) || !Number.isFinite(heightCm) || heightCm <= 0) {
    bmiField.value = "";
    return;
  }

  const heightMeters = heightCm / 100;
  const bmi = weight / (heightMeters * heightMeters);
  bmiField.value = bmi.toFixed(2);
}

function calculateAge() {
  const birthDateField = form.querySelector('[name="birthDate"]');
  const ageField = form.querySelector('[name="age"]');

  if (!birthDateField || !ageField) return;

  if (!birthDateField.value) {
    ageField.value = "";
    return;
  }

  const birthDate = new Date(`${birthDateField.value}T00:00:00`);
  if (Number.isNaN(birthDate.getTime())) {
    ageField.value = "";
    return;
  }

  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDifference = today.getMonth() - birthDate.getMonth();

  if (monthDifference < 0 || (monthDifference === 0 && today.getDate() < birthDate.getDate())) {
    age -= 1;
  }

  ageField.value = age >= 0 ? String(age) : "";
}

function setupAutoCalculations() {
  const weightField = form.querySelector('[name="weight"]');
  const heightField = form.querySelector('[name="height"]');
  const birthDateField = form.querySelector('[name="birthDate"]');

  weightField?.addEventListener("input", calculateBMI);
  heightField?.addEventListener("input", calculateBMI);
  birthDateField?.addEventListener("input", calculateAge);
  birthDateField?.addEventListener("change", calculateAge);

  calculateBMI();
  calculateAge();
}

function setupVisualMasks() {
  const cpfField = form.querySelector('[name="cpf"]');
  const phoneField = form.querySelector('[name="phone"]');

  if (cpfField) {
    cpfField.addEventListener("input", () => {
      cpfField.value = formatCpf(cpfField.value);
    });
    cpfField.value = formatCpf(cpfField.value);
  }

  if (phoneField) {
    phoneField.addEventListener("input", () => {
      phoneField.value = formatPhone(phoneField.value);
    });
    phoneField.value = formatPhone(phoneField.value);
  }
}

form.addEventListener("input", scheduleAutoSave);
form.addEventListener("change", scheduleAutoSave);
if (form) {
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    // sempre redireciona para a lista após salvar para visual feedback
    persistRecord({ redirectToRecords: true });
  });
}

if (clearBtn) {
  clearBtn.addEventListener("click", () => {
    const confirmed = window.confirm("Deseja limpar o formulário e apagar o rascunho salvo?");
    if (confirmed) {
      clearCurrentForm();
    }
  });
}

if (newRecordBtn) {
  newRecordBtn.addEventListener("click", handleNewRecordAction);
}

function buildPrintableHtml(dataHtml) {
  return `<!doctype html><html><head><meta charset=\"utf-8\"><title>Imprimir prontuário</title>
    <link rel=\"stylesheet\" href=\"styles.css\"> <style>body{padding:20px;font-family:Inter,system-ui,sans-serif} .card{box-shadow:none;border:0}</style>
    </head><body>${dataHtml}</body></html>`;
}

// function handlePrintAction() {
//   try {
//     // Esconde os botões da seção de ações do formulário
//     const formActions = document.querySelector('.form-actions');
//     const wasHidden = formActions?.style.display;
//     if (formActions) formActions.style.display = 'none';

//     // Dispara o print do navegador
//     window.print();

//     // Restaura os botões após um pequeno atraso
//     setTimeout(() => {
//       if (formActions) formActions.style.display = wasHidden || '';
//     }, 100);
//   } catch (err) {
//     console.error(err);
//     showToast("Erro ao preparar impressão");
//   }
// }
function handlePrintAction() {
  try {
    const data = collectFormData();

    // Funções auxiliares para formatar os dados na impressão
    const formatValue = (val) => {
      if (Array.isArray(val)) return val.length > 0 ? val.join(', ') : '---';
      if (typeof val === 'boolean') return val ? 'Sim' : 'Não';
      if (val === undefined || val === null || val === '') return '---';
      return val;
    };

    const formatDate = (dateStr) => {
      if (!dateStr) return '---';
      const [y, m, d] = dateStr.split('-');
      return `${d}/${m}/${y}`;
    };

    // Construção do layout compacto com as 4 seções solicitadas
    const printContent = `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="utf-8">
        <title>Prontuário - Inserção de DIU</title>
        <style>
          @page { margin: 1cm; }
          body { font-family: Arial, sans-serif; font-size: 11px; line-height: 1.3; color: #000; }
          h1 { font-size: 14px; text-align: center; margin: 0 0 10px 0; text-transform: uppercase; }
          h2 { font-size: 12px; background: #f0f0f0; padding: 4px; border: 1px solid #ccc; margin: 10px 0 5px 0; text-transform: uppercase; font-weight: bold; }
          .grid { display: flex; flex-wrap: wrap; column-gap: 15px; row-gap: 5px; }
          .item { flex: 1 1 auto; min-width: 150px; border-bottom: 1px dotted #ccc; padding-bottom: 2px; }
          .item-full { flex: 1 1 100%; border-bottom: 1px dotted #ccc; padding-bottom: 2px; }
          strong { font-weight: bold; }
          .footer { margin-top: 20px; text-align: center; font-size: 10px; border-top: 1px solid #000; padding-top: 5px; width: 60%; margin-left: auto; margin-right: auto; }
        </style>
      </head>
      <body>
        <h1>Ficha Clínica - Consulta de Enfermagem (DIU)</h1>

        <h2>1. Identificação</h2>
        <div class="grid">
          <div class="item"><strong>Data do Atendimento:</strong> ${formatDate(data.attendanceDate)}</div>
          <div class="item"><strong>N° Prontuário:</strong> ${formatValue(data.recordNumber)}</div>
          <div class="item-full"><strong>Nome:</strong> ${formatValue(data.patientName)}</div>
          <div class="item"><strong>Nascimento:</strong> ${formatDate(data.birthDate)} (${formatValue(data.age)} anos)</div>
          <div class="item"><strong>RG:</strong> ${formatValue(data.rg)}</div>
          <div class="item"><strong>CPF:</strong> ${formatValue(data.cpf)}</div>
          <div class="item"><strong>CNS:</strong> ${formatValue(data.cns)}</div>
          <div class="item"><strong>Telefone:</strong> ${formatValue(data.phone)}</div>
          <div class="item"><strong>Religião:</strong> ${formatValue(data.religion)}</div>
          <div class="item"><strong>Cor/Raça:</strong> ${formatValue(data.race)}</div>
          <div class="item"><strong>Escolaridade:</strong> ${formatValue(data.education)}</div>
          <div class="item"><strong>Profissão:</strong> ${formatValue(data.occupation)}</div>
          <div class="item"><strong>PcD:</strong> ${formatValue(data.disability)}</div>
          <div class="item-full"><strong>Endereço:</strong> ${formatValue(data.address)}</div>
        </div>

        <h2>2. Subjetivo (Anamnese e Motivo da Consulta)</h2>
        <div class="grid">
          <div class="item-full"><strong>Motivação para DIU:</strong> ${formatValue(data.motivation)} ${data.motivationOther ? '- ' + data.motivationOther : ''}</div>
          <div class="item-full"><strong>Condições de Saúde:</strong> ${formatValue(data.healthConditions)}</div>
          <div class="item-full"><strong>Uso de Medicamentos:</strong> ${formatValue(data.medications)}</div>
          
          <div class="item"><strong>DUM:</strong> ${formatDate(data.dum)}</div>
          <div class="item"><strong>Coitarca:</strong> ${formatValue(data.coitarca)}</div>
          <div class="item"><strong>Ciclos:</strong> ${formatValue(data.cycles)}</div>
          <div class="item"><strong>Fluxo:</strong> ${formatValue(data.flowCycle)}</div>
          <div class="item"><strong>Sangramento (90 dias):</strong> ${formatValue(data.bleedingPattern)}</div>
          <div class="item"><strong>Dismenorreia:</strong> ${formatValue(data.dysmenorrhea)}</div>
          <div class="item"><strong>Anemia:</strong> ${formatValue(data.anemia)}</div>
          
          <div class="item-full"><strong>Cirurgias Ginecológicas:</strong> ${formatValue(data.gynSurgeries)}</div>
          
          <div class="item"><strong>MAC Atual:</strong> ${formatValue(data.currentMethod)} ${data.currentMethodWhich ? '('+data.currentMethodWhich+')' : ''} ${data.condomMode ? '('+data.condomMode+')' : ''} ${data.currentMethodOther ? '- '+data.currentMethodOther : ''}</div>
          <div class="item"><strong>Parcerias Recentes:</strong> ${formatValue(data.recentPartners)}</div>
          <div class="item"><strong>História de IST:</strong> ${formatValue(data.stiHistory)}</div>
          <div class="item"><strong>IST Ativa:</strong> ${formatValue(data.activeSti)}</div>
          <div class="item"><strong>Alto Risco IST:</strong> ${formatValue(data.highStiRisk)}</div>
          <div class="item"><strong>HIV/AIDS:</strong> ${formatValue(data.hiv)}</div>
          <div class="item"><strong>ARV:</strong> ${formatValue(data.antiretroviral)} ${data.antiretroviralWhich ? '('+data.antiretroviralWhich+')' : ''}</div>
          <div class="item"><strong>DIPA (3 meses):</strong> ${formatValue(data.dipa)}</div>
          <div class="item"><strong>Miomatose Volumosa:</strong> ${formatValue(data.largeMyoma)}</div>
          <div class="item"><strong>Câncer Cervical:</strong> ${formatValue(data.cervicalCancer)}</div>
          <div class="item"><strong>Última C.O.:</strong> ${formatDate(data.lastCo)}</div>

          <div class="item"><strong>Gesta:</strong> ${formatValue(data.gesta)}</div>
          <div class="item"><strong>Para:</strong> ${formatValue(data.para)}</div>
          <div class="item"><strong>Abortos:</strong> ${formatValue(data.abortions)}</div>
          <div class="item"><strong>Cesáreas:</strong> ${formatValue(data.cesareans)}</div>
          <div class="item"><strong>Último Parto:</strong> ${formatDate(data.lastBirthDate)}</div>
          <div class="item"><strong>Último Aborto:</strong> ${formatDate(data.lastAbortionDate)}</div>
          <div class="item"><strong>Infecção Pós-parto/aborto:</strong> ${formatValue(data.postInfection)}</div>
          
          <div class="item"><strong>DIU Escolhido:</strong> ${formatValue(data.chosenIud)}</div>
          <div class="item"><strong>Elegibilidade:</strong> ${formatValue(data.eligibility)}</div>
          <div class="item-full"><strong>Informada sobre contraindicações/efeitos?</strong> ${formatValue(data.informed)}</div>
        </div>

        <h2>3. Objetivo (Exame Físico, Exames e Inserção)</h2>
        <div class="grid">
          <div class="item"><strong>Peso:</strong> ${formatValue(data.weight)} kg</div>
          <div class="item"><strong>Altura:</strong> ${formatValue(data.height)} cm</div>
          <div class="item"><strong>IMC:</strong> ${formatValue(data.bmi)}</div>
          <div class="item"><strong>PA:</strong> ${formatValue(data.bloodPressure)}</div>
          
          <div class="item"><strong>Exame Pélvico:</strong> ${formatValue(data.pelvicExam)}</div>
          <div class="item"><strong>Cervicite Purulenta:</strong> ${formatValue(data.purulentCervicitis)}</div>
          
          <div class="item"><strong>Data da Inserção:</strong> ${formatDate(data.insertionDate)}</div>
          <div class="item"><strong>Tipo de Inserção:</strong> ${formatValue(data.insertionType)}</div>
          <div class="item"><strong>Dilatação Cervical:</strong> ${formatValue(data.cervicalDilation)}</div>
          <div class="item"><strong>Escala de Dor:</strong> ${formatValue(data.painScale)}</div>
          <div class="item"><strong>Momento da Dor:</strong> ${formatValue(data.moment)} ${data.momentOther ? '- '+data.momentOther : ''}</div>
          <div class="item"><strong>Histerometria:</strong> ${formatValue(data.hysterometry)} cm</div>
          <div class="item"><strong>Posição do Útero:</strong> ${formatValue(data.uterusPosition)} ${data.uterusPositionOther ? '- '+data.uterusPositionOther : ''}</div>
          
          <div class="item"><strong>Analgesia Usada:</strong> Gel (${formatValue(data.gelUsed)}), Spray (${formatValue(data.sprayUsed)}), Injetável (${formatValue(data.injectableUsed)})</div>
          
          <div class="item-full"><strong>Intercorrências:</strong> ${formatValue(data.intercurrences)} ${data.notInsertedReason ? '(Motivo não inserido: '+data.notInsertedReason+')' : ''} ${data.otherIntercurrences ? '- '+data.otherIntercurrences : ''}</div>
        </div>

        <h2>4. Avaliação: Diagnóstico de Enfermagem (CIPE) e Planejamento</h2>
        <div class="grid">
          <div class="item-full"><strong>Diagnósticos:</strong> ${formatValue(data.diagnosis)} ${data.diagnosisOther ? '- '+data.diagnosisOther : ''}</div>
          <div class="item-full"><strong>Resultados Esperados:</strong> ${formatValue(data.results)} ${data.resultsOther ? '- '+data.resultsOther : ''}</div>
          <div class="item-full"><strong>Intervenções:</strong> ${formatValue(data.interventions)}</div>
          <div class="item-full"><strong>Outras Intervenções:</strong> ${formatValue(data.interventionsOther)}</div>
          <div class="item"><strong>Data do Acompanhamento (Retorno):</strong> ${formatDate(data.followUpDate)}</div>
          <div class="item"><strong>Local do Documento:</strong> ${formatValue(data.location)}</div>
          <div class="item"><strong>Data do Documento:</strong> ${formatDate(data.documentDate)}</div>
        </div>
        
        <div class="footer">
          Assinatura e Carimbo do Profissional
        </div>
      </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      
      printWindow.onload = function() {
        printWindow.focus();
        printWindow.print();
      };
    } else {
      showToast("O bloqueador de pop-ups impediu a impressão.");
    }
  } catch (err) {
    console.error(err);
    showToast("Erro ao preparar impressão");
  }
}

window.addEventListener("beforeunload", () => {
  if (saveTimer) {
    window.clearTimeout(saveTimer);
    saveDraft();
  }
});

loadCurrentFormState();
setupAutoCalculations();
setupVisualMasks();
registerServiceWorker();
