// Campos gravados só com dígitos (a máscara é apenas visual).
const INTEGER_FIELDS = ["cpf", "cns", "phone"];
// Campos de texto livre que podem ter letras (ex.: RG terminado em "X"); só os espaços das pontas saem.
const TRIMMED_FIELDS = ["recordNumber", "rg", "patientName"];

export function getFieldValue(field) {
  if (field.type === "checkbox") {
    return field.checked;
  }

  if (field.type === "radio") {
    if (!field.checked) return null;
    return field.value;
  }

  return field.value;
}

export function setFieldValue(field, value) {
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

export function sanitizeInteger(value) {
  if (value === null || value === undefined || value === "") return "";
  return String(value).replace(/\D/g, "");
}

export function formatCpf(value) {
  const digits = sanitizeInteger(value).slice(0, 11);
  if (!digits) return "";

  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

// "dias de fluxo/dias do ciclo", com 1 ou 2 dígitos de cada lado. A barra digitada é respeitada
// ("5/28"); sem barra, ela entra sozinha depois do segundo dígito ("0528" -> "05/28").
export function formatFlowCycle(value) {
  const text = String(value ?? "");
  const slashIndex = text.indexOf("/");

  if (slashIndex >= 0) {
    const flow = sanitizeInteger(text.slice(0, slashIndex)).slice(0, 2);
    const cycle = sanitizeInteger(text.slice(slashIndex + 1)).slice(0, 2);
    return flow ? `${flow}/${cycle}` : cycle;
  }

  const digits = sanitizeInteger(text).slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}/${digits.slice(2)}`;
}

export function formatCoitarca(value) {
  const digits = sanitizeInteger(value).slice(0, 2);
  if (!digits) return "";
  return `${digits} anos`;
}

export function formatPhone(value) {
  const digits = sanitizeInteger(value).slice(0, 11);
  if (!digits) return "";

  if (digits.length < 3) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

export function normalizeTypedFields(data) {
  const normalized = { ...data };

  for (const field of INTEGER_FIELDS) {
    if (field in normalized) {
      normalized[field] = sanitizeInteger(normalized[field]);
    }
  }

  for (const field of TRIMMED_FIELDS) {
    if (field in normalized) {
      normalized[field] = String(normalized[field] ?? "").trim();
    }
  }

  return normalized;
}

export function collectFormData(form) {
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

export function restoreFormData(form, data) {
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

// PA em dois campos numéricos (sistólica e diastólica), gravada em "bloodPressure" como "120x80".
// Deve ser chamada depois de o formulário ser preenchido com os dados salvos.
export function setupBloodPressure(form) {
  const stored = form.querySelector('[name="bloodPressure"]');
  const systolic = form.querySelector("#bpSystolic");
  const diastolic = form.querySelector("#bpDiastolic");
  if (!stored || !systolic || !diastolic) return;

  const match = stored.value.trim().match(/^(\d{1,3})\s*[x×/]\s*(\d{1,3})/i);
  if (match) {
    systolic.value = match[1];
    diastolic.value = match[2];
  }

  const update = () => {
    const hasValue = systolic.value !== "" || diastolic.value !== "";
    stored.value = hasValue ? `${systolic.value}x${diastolic.value}` : "";
    // Preenchido um dos valores, o outro passa a ser obrigatório.
    systolic.required = diastolic.value !== "";
    diastolic.required = systolic.value !== "";
  };

  systolic.addEventListener("input", update);
  diastolic.addEventListener("input", update);
  form.addEventListener("reset", () => {
    systolic.required = false;
    diastolic.required = false;
  });
}

// Opção que não pode ser combinada com as demais do grupo (ex.: "Sem intercorrências"):
// marcá-la desmarca as outras, e marcar qualquer outra a desmarca. As demais combinam entre si.
export function setupExclusiveOption(exclusive, others) {
  if (!exclusive || others.length === 0) return;

  exclusive.addEventListener("change", () => {
    if (!exclusive.checked) return;
    for (const other of others) other.checked = false;
  });

  for (const other of others) {
    other.addEventListener("change", () => {
      if (other.checked) exclusive.checked = false;
    });
  }
}

export function calculateBMI(form) {
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

export function calculateAge(form) {
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

export function setupAutoCalculations(form) {
  const weightField = form.querySelector('[name="weight"]');
  const heightField = form.querySelector('[name="height"]');
  const birthDateField = form.querySelector('[name="birthDate"]');

  weightField?.addEventListener("input", () => calculateBMI(form));
  heightField?.addEventListener("input", () => calculateBMI(form));
  birthDateField?.addEventListener("input", () => calculateAge(form));
  birthDateField?.addEventListener("change", () => calculateAge(form));

  calculateBMI(form);
  calculateAge(form);
}

export function setupVisualMasks(form) {
  const cpfField = form.querySelector('[name="cpf"]');
  const phoneField = form.querySelector('[name="phone"]');
  const flowCycleField = form.querySelector('[name="flowCycle"]');
  const coitarcaField = form.querySelector('[name="coitarca"]');

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

  if (flowCycleField) {
    flowCycleField.addEventListener("input", () => {
      flowCycleField.value = formatFlowCycle(flowCycleField.value);
    });
    flowCycleField.value = formatFlowCycle(flowCycleField.value);
  }

  if (coitarcaField) {
    // O sufixo " anos" é recolocado a cada tecla; ao apagar, é preciso remover um dígito,
    // senão o backspace só apagaria uma letra do sufixo e o campo nunca esvaziaria.
    let lastDigits = sanitizeInteger(coitarcaField.value).slice(0, 2);
    coitarcaField.addEventListener("input", (event) => {
      let digits = sanitizeInteger(coitarcaField.value).slice(0, 2);
      if (String(event.inputType ?? "").startsWith("delete") && digits === lastDigits) {
        digits = digits.slice(0, -1);
      }
      lastDigits = digits;
      coitarcaField.value = formatCoitarca(digits);
    });
    coitarcaField.value = formatCoitarca(coitarcaField.value);
  }
}

// Permite desmarcar um radio clicando de novo na opção já marcada (ou com a barra de espaço).
export function setupRadioDeselect(form) {
  let checkedBeforeInteraction = new Set();
  const snapshot = () => {
    checkedBeforeInteraction = new Set(form.querySelectorAll('input[type="radio"]:checked'));
  };

  form.addEventListener("pointerdown", snapshot, true);
  form.addEventListener("keydown", snapshot, true);

  form.addEventListener("click", (event) => {
    const radio = event.target;
    if (!(radio instanceof HTMLInputElement) || radio.type !== "radio") return;
    if (!checkedBeforeInteraction.has(radio)) return;

    checkedBeforeInteraction.delete(radio);
    radio.checked = false;
    radio.dispatchEvent(new Event("input", { bubbles: true }));
    radio.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

// O service worker atualiza os arquivos em segundo plano e a versão nova passa a valer na
// próxima abertura. A página nunca é recarregada sozinha, para não interromper um preenchimento.
export function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;

  navigator.serviceWorker.register("sw.js").catch((error) => {
    console.warn("Service worker não registrado", error);
  });
}
