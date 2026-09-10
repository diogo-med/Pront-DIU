const INTEGER_FIELDS = ["recordNumber", "rg", "cpf", "cns", "phone"];

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

  if ("patientName" in normalized) {
    normalized.patientName = String(normalized.patientName ?? "").trim();
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

export function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js")
      .then((registration) => {
        registration.addEventListener("updatefound", () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener("statechange", () => {
              if (newWorker.state === "activated") {
                console.log("Nova versão detectada! Recarregando...");
                window.location.reload();
              }
            });
          }
        });
      })
      .catch((error) => {
        console.warn("Service worker não registrado", error);
      });

    let refreshing = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (!refreshing) {
        refreshing = true;
        window.location.reload();
      }
    });
  }
}
