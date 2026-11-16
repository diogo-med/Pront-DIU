const DB_NAME = "prontdiu-db";
const DB_VERSION = 1;
const RECORDS_STORE = "records";
const KV_STORE = "kv";

const DRAFT_TRIAGEM_KEY = "draftTriagem";
const DRAFT_INSERCAO_KEY = "draftInsercao";
const LEGACY_SINGLE_DRAFT_KEY = "draft";
const EDITING_RECORD_KEY = "prontdiu.editingRecordId.v1";

const LEGACY_RECORDS_KEY = "prontdiu.records.v1";
const LEGACY_DRAFT_KEY = "prontdiu.form.v1";

// Campos que pertencem à Triagem (início até a seção 1.5) num registro antigo (pré-divisão),
// usados só para migrar dados já salvos para o novo formato { triagem, insercao }.
const TRIAGEM_FIELD_NAMES = [
  "attendanceDate", "triageDate", "recordNumber", "patientName", "birthDate", "age",
  "rg", "cpf", "cns", "religion", "phone", "occupation", "race", "education", "disability", "address",
  "motivation", "motivationOther",
  "healthConditions", "medications", "dum", "coitarca", "dysmenorrhea", "cycles", "flowCycle",
  "bleedingPattern", "anemia", "gynSurgeries", "currentMethod", "currentMethodWhich", "condomMode",
  "currentMethodOther", "recentPartners", "stiHistory", "activeSti", "highStiRisk", "hiv",
  "antiretroviral", "antiretroviralWhich", "dipa", "largeMyoma", "cervicalCancer", "lastCo",
  "gesta", "para", "abortions", "cesareans", "lastBirthDate", "lastAbortionDate", "postInfection",
  "chosenIud", "informed", "eligibility",
];

// Campos que pertencem à Inserção (seção 1.6 até o fim) num registro antigo.
const INSERCAO_FIELD_NAMES = [
  "weight", "height", "bmi", "bloodPressure", "pelvicExam", "purulentCervicitis",
  "insertionType", "cervicalDilation", "painScale", "moment", "momentOther", "hysterometry",
  "analgesiaGel", "analgesiaSpray", "analgesiaInjectable", "analgesiaNotUsed", "analgesiaDetails",
  "uterusPosition", "uterusPositionOther",
  "intercurrences", "notInsertedReason", "otherIntercurrences",
  "diagnosis", "diagnosisOther", "results", "resultsOther", "interventions", "interventionsOther",
  "followUpDate", "location", "documentDate",
];

function splitLegacyFlatData(flatData) {
  const triagem = {};
  const insercao = {};

  for (const [key, value] of Object.entries(flatData ?? {})) {
    if (key === "insertionDate") {
      // No formato antigo esse campo ficava na seção 1.5 (Triagem); hoje equivale à
      // "data marcada para inserção" preenchida na Triagem.
      triagem.scheduledInsertionDate = value;
      continue;
    }
    if (TRIAGEM_FIELD_NAMES.includes(key)) {
      triagem[key] = value;
    } else if (INSERCAO_FIELD_NAMES.includes(key)) {
      insercao[key] = value;
    }
  }

  if (Object.keys(insercao).length > 0) {
    insercao.patientName = triagem.patientName ?? "";
    insercao.recordNumber = triagem.recordNumber ?? "";
    insercao.birthDate = triagem.birthDate ?? "";
  }

  return { triagem, insercao };
}

let dbPromise = null;

function openDatabase() {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(RECORDS_STORE)) {
        db.createObjectStore(RECORDS_STORE, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(KV_STORE)) {
        db.createObjectStore(KV_STORE);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      // Não guarda a falha em cache: a próxima operação tenta abrir o banco de novo.
      dbPromise = null;
      reject(request.error);
    };
  });

  return dbPromise;
}

function withStore(storeName, mode, executor) {
  return openDatabase().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, mode);
        const request = executor(tx.objectStore(storeName));
        // Só confirma depois do commit da transação: o "onsuccess" do request dispara antes
        // de os dados estarem gravados, e erros de cota só aparecem no abort.
        tx.oncomplete = () => resolve(request.result);
        tx.onerror = () => reject(tx.error ?? request.error);
        tx.onabort = () => reject(tx.error ?? request.error ?? new Error("Transação abortada"));
      })
  );
}

export function getAllRecords() {
  return withStore(RECORDS_STORE, "readonly", (store) => store.getAll());
}

export function getRecordById(id) {
  return withStore(RECORDS_STORE, "readonly", (store) => store.get(id));
}

export function putRecord(record) {
  return withStore(RECORDS_STORE, "readwrite", (store) => store.put(record));
}

// Grava vários registros em uma única transação (tudo ou nada).
export function putRecords(records) {
  return openDatabase().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(RECORDS_STORE, "readwrite");
        const store = tx.objectStore(RECORDS_STORE);
        for (const record of records) store.put(record);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error ?? new Error("Transação abortada"));
      })
  );
}

export function deleteRecordById(id) {
  return withStore(RECORDS_STORE, "readwrite", (store) => store.delete(id));
}

export function getTriagemDraft() {
  return withStore(KV_STORE, "readonly", (store) => store.get(DRAFT_TRIAGEM_KEY)).then((value) => value ?? null);
}

export function setTriagemDraft(data) {
  return withStore(KV_STORE, "readwrite", (store) => store.put(data, DRAFT_TRIAGEM_KEY));
}

export function clearTriagemDraft() {
  return withStore(KV_STORE, "readwrite", (store) => store.delete(DRAFT_TRIAGEM_KEY));
}

export function getInsercaoDraft() {
  return withStore(KV_STORE, "readonly", (store) => store.get(DRAFT_INSERCAO_KEY)).then((value) => value ?? null);
}

export function setInsercaoDraft(data) {
  return withStore(KV_STORE, "readwrite", (store) => store.put(data, DRAFT_INSERCAO_KEY));
}

export function clearInsercaoDraft() {
  return withStore(KV_STORE, "readwrite", (store) => store.delete(DRAFT_INSERCAO_KEY));
}

export function getEditingRecordId() {
  return sessionStorage.getItem(EDITING_RECORD_KEY);
}

export function setEditingRecordId(recordId) {
  if (!recordId) {
    sessionStorage.removeItem(EDITING_RECORD_KEY);
    return;
  }
  sessionStorage.setItem(EDITING_RECORD_KEY, recordId);
}

// Pede ao navegador para não apagar os dados locais sob pressão de armazenamento.
// Funciona totalmente offline; alguns navegadores só concedem com o app instalado.
export async function requestPersistentStorage() {
  try {
    if (!navigator.storage?.persist) return false;
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch (error) {
    console.warn("Não foi possível solicitar armazenamento persistente", error);
    return false;
  }
}

let migrationPromise = null;

// Migra dados de versões anteriores do app: localStorage -> IndexedDB, registro único
// "data" (pré-divisão Triagem/Inserção) -> { triagem, insercao }, e rascunho único -> dois rascunhos.
export function runMigrations() {
  if (migrationPromise) return migrationPromise;

  migrationPromise = (async () => {
    await migrateFromLocalStorage();
    await migrateFlatRecordsToSplitShape();
    await migrateSingleDraftToSplitDrafts();
    await migrateTriagemFields();
  })();

  return migrationPromise;
}

async function migrateFromLocalStorage() {
  const legacyRecordsRaw = localStorage.getItem(LEGACY_RECORDS_KEY);
  const legacyDraftRaw = localStorage.getItem(LEGACY_DRAFT_KEY);
  if (!legacyRecordsRaw && !legacyDraftRaw) return;

  try {
    if (legacyRecordsRaw) {
      const legacyRecords = JSON.parse(legacyRecordsRaw);
      if (Array.isArray(legacyRecords)) {
        for (const record of legacyRecords) {
          if (record && record.id) await putRecord(record);
        }
      }
    }

    if (legacyDraftRaw) {
      const legacyDraft = JSON.parse(legacyDraftRaw);
      if (legacyDraft && typeof legacyDraft === "object") {
        await withStore(KV_STORE, "readwrite", (store) => store.put(legacyDraft, LEGACY_SINGLE_DRAFT_KEY));
      }
    }
  } catch (error) {
    console.error("Falha ao migrar dados antigos do localStorage", error);
    return;
  }

  localStorage.removeItem(LEGACY_RECORDS_KEY);
  localStorage.removeItem(LEGACY_DRAFT_KEY);
}

async function migrateFlatRecordsToSplitShape() {
  const records = await getAllRecords();
  for (const record of records) {
    if (record && record.data && !record.triagem && !record.insercao) {
      const { triagem, insercao } = splitLegacyFlatData(record.data);
      const { data, ...rest } = record;
      await putRecord({
        ...rest,
        triagem: Object.keys(triagem).length > 0 ? triagem : null,
        insercao: Object.keys(insercao).length > 0 ? insercao : null,
      });
    }
  }
}

async function migrateSingleDraftToSplitDrafts() {
  const legacyDraft = await withStore(KV_STORE, "readonly", (store) => store.get(LEGACY_SINGLE_DRAFT_KEY)).then(
    (value) => value ?? null
  );
  if (!legacyDraft) return;

  const { triagem, insercao } = splitLegacyFlatData(legacyDraft);
  if (Object.keys(triagem).length > 0) await setTriagemDraft(triagem);
  if (Object.keys(insercao).length > 0) await setInsercaoDraft(insercao);
  await withStore(KV_STORE, "readwrite", (store) => store.delete(LEGACY_SINGLE_DRAFT_KEY));
}

// Ajustes de campos da Triagem entre versões:
// - "Data do atendimento" foi removido; a data da triagem passa a ocupar o lugar dele.
// - O valor do DIU de cobre era gravado como "Tcu"; o correto é "TCu".
function migrateTriagemData(triagem) {
  if (!triagem || typeof triagem !== "object") return null;
  let result = null;

  if ("attendanceDate" in triagem) {
    const { attendanceDate, ...rest } = triagem;
    result = { ...rest, triageDate: rest.triageDate || attendanceDate || "" };
  }

  if ((result ?? triagem).chosenIud === "Tcu") {
    result = { ...(result ?? triagem), chosenIud: "TCu" };
  }

  return result;
}

async function migrateTriagemFields() {
  const records = await getAllRecords();
  for (const record of records) {
    const triagem = migrateTriagemData(record?.triagem);
    if (triagem) await putRecord({ ...record, triagem });
  }

  const triagemDraft = migrateTriagemData(await getTriagemDraft());
  if (triagemDraft) await setTriagemDraft(triagemDraft);

  const insercaoDraft = await getInsercaoDraft();
  const linkedTriagem = migrateTriagemData(insercaoDraft?._linkedTriagem);
  if (linkedTriagem) await setInsercaoDraft({ ...insercaoDraft, _linkedTriagem: linkedTriagem });
}
