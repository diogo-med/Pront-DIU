import { formatDateOnly } from "./ui.js";

// Campos identificadores que nunca podem sair no CSV (exportação anonimizada).
const IDENTIFYING_FIELDS = new Set(["patientName", "birthDate", "rg", "cpf", "cns", "phone"]);

const IDENTIFICACAO_FIELDS = [
  { key: "triageDate", label: "Data da triagem", type: "date" },
  { key: "recordNumber", label: "N° prontuário" },
  { key: "patientName", label: "Nome" },
  { key: "birthDate", label: "Data de nascimento", type: "date" },
  { key: "age", label: "Idade" },
  { key: "rg", label: "RG" },
  { key: "cpf", label: "CPF" },
  { key: "cns", label: "CNS" },
  { key: "phone", label: "Telefone" },
  { key: "religion", label: "Religião" },
  { key: "race", label: "Cor/Raça" },
  { key: "education", label: "Escolaridade" },
  { key: "occupation", label: "Profissão/Ocupação" },
  { key: "disability", label: "PcD" },
  { key: "address", label: "Endereço" },
];

const SUBJETIVO_FIELDS = [
  { key: "motivation", label: "Motivação para DIU" },
  { key: "motivationOther", label: "Motivação (outras)" },
  { key: "healthConditions", label: "Condições de saúde" },
  { key: "medications", label: "Uso de medicamentos" },
  { key: "dum", label: "DUM", type: "date" },
  { key: "coitarca", label: "Coitarca" },
  { key: "cycles", label: "Ciclos" },
  { key: "flowCycle", label: "Fluxo/ciclo" },
  { key: "bleedingPattern", label: "Sangramento (90 dias)" },
  { key: "dysmenorrhea", label: "Dismenorreia" },
  { key: "anemia", label: "Anemia" },
  { key: "gynSurgeries", label: "Cirurgias ginecológicas" },
  { key: "currentMethod", label: "MAC atual" },
  { key: "currentMethodWhich", label: "MAC atual (qual)" },
  { key: "condomMode", label: "Preservativo (modo)" },
  { key: "currentMethodOther", label: "MAC atual (outro)" },
  { key: "recentPartners", label: "Parcerias recentes" },
  { key: "stiHistory", label: "História de IST" },
  { key: "activeSti", label: "IST ativa" },
  { key: "highStiRisk", label: "Alto risco IST" },
  { key: "hiv", label: "HIV/AIDS" },
  { key: "antiretroviral", label: "ARV" },
  { key: "antiretroviralWhich", label: "ARV (qual)" },
  { key: "dipa", label: "DIPA (3 meses)" },
  { key: "largeMyoma", label: "Miomatose volumosa" },
  { key: "cervicalCancer", label: "Câncer cervical" },
  { key: "lastCo", label: "Última C.O.", type: "date" },
  { key: "gesta", label: "Gesta" },
  { key: "para", label: "Para" },
  { key: "abortions", label: "Abortos" },
  { key: "cesareans", label: "Cesáreas" },
  { key: "lastBirthDate", label: "Último parto", type: "date" },
  { key: "lastAbortionDate", label: "Último aborto", type: "date" },
  { key: "postInfection", label: "Infecção pós-parto/aborto" },
  { key: "chosenIud", label: "DIU escolhido" },
  { key: "eligibility", label: "Elegibilidade" },
  { key: "scheduledInsertionDate", label: "Data marcada para inserção", type: "date" },
  { key: "informed", label: "Informada sobre contraindicações/efeitos" },
];

const OBJETIVO_FIELDS = [
  { key: "weight", label: "Peso (kg)" },
  { key: "height", label: "Altura (cm)" },
  { key: "bmi", label: "IMC" },
  { key: "bloodPressure", label: "PA" },
  { key: "pelvicExam", label: "Exame pélvico" },
  { key: "purulentCervicitis", label: "Cervicite purulenta" },
  { key: "insertionDate", label: "Data da inserção", type: "date" },
  { key: "insertionType", label: "Tipo de inserção" },
  { key: "cervicalDilation", label: "Dilatação cervical" },
  { key: "painScale", label: "Escala de dor" },
  { key: "moment", label: "Momento da dor" },
  { key: "momentOther", label: "Momento da dor (outro)" },
  { key: "hysterometry", label: "Histerometria (cm)" },
  { key: "uterusPosition", label: "Posição do útero" },
  { key: "uterusPositionOther", label: "Posição do útero (outra)" },
  { key: "analgesiaGel", label: "Analgesia: gel" },
  { key: "analgesiaSpray", label: "Analgesia: spray" },
  { key: "analgesiaInjectable", label: "Analgesia: injetável" },
  { key: "analgesiaNotUsed", label: "Analgesia: não utilizada" },
  { key: "analgesiaDetails", label: "Detalhes do analgésico" },
  { key: "intercurrences", label: "Intercorrências" },
  { key: "notInsertedReason", label: "Motivo da não inserção" },
  { key: "otherIntercurrences", label: "Outras intercorrências" },
];

const AVALIACAO_FIELDS = [
  { key: "diagnosis", label: "Diagnósticos" },
  { key: "diagnosisOther", label: "Diagnósticos (outro)" },
  { key: "results", label: "Resultados esperados" },
  { key: "resultsOther", label: "Resultados esperados (outro)" },
  { key: "interventions", label: "Intervenções" },
  { key: "interventionsOther", label: "Outras intervenções" },
  { key: "followUpDate", label: "Data do acompanhamento (retorno)", type: "date" },
  { key: "location", label: "Local do documento" },
  { key: "documentDate", label: "Data do documento", type: "date" },
];

// "source" indica de qual parte do registro o campo é lido. A identificação vem da triagem
// e, se não houver triagem, dos poucos campos de identificação gravados na inserção.
const SECTIONS = [
  { title: "1. Identificação", source: "identificacao", fields: IDENTIFICACAO_FIELDS },
  { title: "2. Subjetivo (Anamnese e Motivo da Consulta)", source: "triagem", fields: SUBJETIVO_FIELDS },
  { title: "3. Objetivo (Exame Físico, Exames e Inserção)", source: "insercao", fields: OBJETIVO_FIELDS },
  { title: "4. Avaliação: Diagnóstico de Enfermagem (CIPE) e Planejamento", source: "insercao", fields: AVALIACAO_FIELDS },
];

function getSourceData(record, source) {
  if (source === "identificacao") return record.triagem ?? record.insercao ?? {};
  return record[source] ?? {};
}

function formatPlainDate(value) {
  if (!value) return "";
  const [y, m, d] = String(value).split("-");
  return d && m && y ? `${d}/${m}/${y}` : String(value);
}

function formatPlainValue(value, type) {
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "boolean") return value ? "Sim" : "Não";
  if (value === undefined || value === null) return "";
  if (type === "date") return formatPlainDate(value);
  return String(value).trim();
}

// Separador ";" e BOM UTF-8 para o Excel em pt-BR abrir com colunas e acentos corretos.
// Células iniciadas por = + - @ são prefixadas com ' para não virarem fórmulas.
function escapeCsvCell(value) {
  let text = String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[";\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function buildCsvHeader() {
  const header = ["ID do registro", "Criado em"];
  for (const section of SECTIONS) {
    for (const field of section.fields) {
      if (!IDENTIFYING_FIELDS.has(field.key)) header.push(field.label);
    }
  }
  return header;
}

function buildCsvRow(record) {
  const row = [record.id ?? "", record.createdAt ? formatDateOnly(record.createdAt) : ""];
  for (const section of SECTIONS) {
    const data = getSourceData(record, section.source);
    for (const field of section.fields) {
      if (IDENTIFYING_FIELDS.has(field.key)) continue;
      row.push(formatPlainValue(data[field.key], field.type));
    }
  }
  return row;
}

// Uma linha por prontuário, sempre com as mesmas colunas. O CSV de um único prontuário sai sem
// a linha de cabeçalho (para ser colado em uma planilha já existente); o CSV consolidado de
// todos os prontuários leva o cabeçalho uma única vez.
export function buildAnonymizedCsv(records, { includeHeader = false } = {}) {
  const rows = records.map(buildCsvRow);
  if (includeHeader) rows.unshift(buildCsvHeader());

  const lines = rows.map((cells) => cells.map(escapeCsvCell).join(";"));
  return `\ufeff${lines.join("\r\n")}\r\n`;
}

export function buildFormattedText(record) {
  const lines = ["FICHA CLÍNICA - CONSULTA DE ENFERMAGEM (DIU)", ""];

  for (const section of SECTIONS) {
    if (section.source !== "identificacao" && !record[section.source]) continue;
    const data = getSourceData(record, section.source);

    lines.push(section.title.toUpperCase(), "-".repeat(section.title.length));
    for (const field of section.fields) {
      const value = formatPlainValue(data[field.key], field.type);
      lines.push(`${field.label}: ${value || "---"}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

export function buildBackupJson(records) {
  return JSON.stringify({ app: "ProntDIU", type: "backup", exportedAt: new Date().toISOString(), records }, null, 2);
}

const FILE_TYPE_DESCRIPTIONS = {
  "application/json": "Arquivo JSON",
  "text/csv": "Planilha CSV",
  "text/plain": "Arquivo de texto",
};

function isAbort(error) {
  return error?.name === "AbortError";
}

// Salva um arquivo deixando a pessoa escolher o destino sempre que o navegador permitir:
// 1. Chrome/Edge no computador (Windows, Linux, macOS): janela "Salvar como".
// 2. Celular/tablet (Android, iOS): menu de compartilhamento (Arquivos, Drive, etc.).
// 3. Demais casos: download normal, na pasta de downloads configurada no navegador.
// Retorna false se a pessoa cancelou.
export async function saveFile(content, filename, mimeType) {
  const baseType = mimeType.split(";")[0].trim();
  const blob = new Blob([content], { type: mimeType });

  if (typeof window.showSaveFilePicker === "function") {
    try {
      const extension = filename.slice(filename.lastIndexOf("."));
      const handle = await window.showSaveFilePicker({
        suggestedName: filename,
        types: [{ description: FILE_TYPE_DESCRIPTIONS[baseType] ?? "Arquivo", accept: { [baseType]: [extension] } }],
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return true;
    } catch (error) {
      if (isAbort(error)) return false;
      console.warn("Janela de salvar indisponível; usando download normal", error);
    }
  } else if (window.matchMedia?.("(pointer: coarse)").matches && typeof navigator.canShare === "function") {
    try {
      const file = new File([blob], filename, { type: baseType });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: filename });
        return true;
      }
    } catch (error) {
      if (isAbort(error)) return false;
      console.warn("Compartilhamento indisponível; usando download normal", error);
    }
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}
