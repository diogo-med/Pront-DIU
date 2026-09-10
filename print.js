import { escapeHtml } from "./ui.js";

// Os valores impressos vêm de campos livres do formulário e nunca podem ir para o HTML sem escape.
export function formatValue(val) {
  if (Array.isArray(val)) return val.length > 0 ? escapeHtml(val.join(", ")) : "---";
  if (typeof val === "boolean") return val ? "Sim" : "Não";
  if (val === undefined || val === null || val === "") return "---";
  return escapeHtml(val);
}

export function formatDate(dateStr) {
  if (!dateStr) return "---";
  const [y, m, d] = String(dateStr).split("-");
  return escapeHtml(`${d}/${m}/${y}`);
}

export function formatExtra(val) {
  return val ? escapeHtml(val) : "";
}

const PRINT_STYLES = `
  @page { margin: 1cm; }
  body { font-family: Arial, sans-serif; font-size: 11px; line-height: 1.3; color: #000; }
  h1 { font-size: 14px; text-align: center; margin: 0 0 10px 0; text-transform: uppercase; }
  h2 { font-size: 12px; background: #f0f0f0; padding: 4px; border: 1px solid #ccc; margin: 10px 0 5px 0; text-transform: uppercase; font-weight: bold; }
  .grid { display: flex; flex-wrap: wrap; column-gap: 15px; row-gap: 5px; }
  .item { flex: 1 1 auto; min-width: 150px; border-bottom: 1px dotted #ccc; padding-bottom: 2px; }
  .item-full { flex: 1 1 100%; border-bottom: 1px dotted #ccc; padding-bottom: 2px; }
  strong { font-weight: bold; }
  .footer { margin-top: 20px; text-align: center; font-size: 10px; border-top: 1px solid #000; padding-top: 5px; width: 60%; margin-left: auto; margin-right: auto; }
`;

export function buildIdentificacaoHtml(data) {
  return `
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
  `;
}

export function buildMiniIdentificacaoHtml(data) {
  return `
    <h2>Identificação</h2>
    <div class="grid">
      <div class="item"><strong>N° Prontuário:</strong> ${formatValue(data.recordNumber)}</div>
      <div class="item-full"><strong>Nome:</strong> ${formatValue(data.patientName)}</div>
      <div class="item"><strong>Nascimento:</strong> ${formatDate(data.birthDate)}</div>
    </div>
  `;
}

export function buildSubjetivoHtml(data) {
  return `
    <h2>2. Subjetivo (Anamnese e Motivo da Consulta)</h2>
    <div class="grid">
      <div class="item-full"><strong>Motivação para DIU:</strong> ${formatValue(data.motivation)} ${data.motivationOther ? "- " + formatExtra(data.motivationOther) : ""}</div>
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

      <div class="item"><strong>MAC Atual:</strong> ${formatValue(data.currentMethod)} ${data.currentMethodWhich ? "(" + formatExtra(data.currentMethodWhich) + ")" : ""} ${data.condomMode ? "(" + formatExtra(data.condomMode) + ")" : ""} ${data.currentMethodOther ? "- " + formatExtra(data.currentMethodOther) : ""}</div>
      <div class="item"><strong>Parcerias Recentes:</strong> ${formatValue(data.recentPartners)}</div>
      <div class="item"><strong>História de IST:</strong> ${formatValue(data.stiHistory)}</div>
      <div class="item"><strong>IST Ativa:</strong> ${formatValue(data.activeSti)}</div>
      <div class="item"><strong>Alto Risco IST:</strong> ${formatValue(data.highStiRisk)}</div>
      <div class="item"><strong>HIV/AIDS:</strong> ${formatValue(data.hiv)}</div>
      <div class="item"><strong>ARV:</strong> ${formatValue(data.antiretroviral)} ${data.antiretroviralWhich ? "(" + formatExtra(data.antiretroviralWhich) + ")" : ""}</div>
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
      <div class="item"><strong>Data marcada para inserção:</strong> ${formatDate(data.scheduledInsertionDate)}</div>
      <div class="item-full"><strong>Informada sobre contraindicações/efeitos?</strong> ${formatValue(data.informed)}</div>
    </div>
  `;
}

export function buildObjetivoHtml(data) {
  return `
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
      <div class="item"><strong>Momento da Dor:</strong> ${formatValue(data.moment)} ${data.momentOther ? "- " + formatExtra(data.momentOther) : ""}</div>
      <div class="item"><strong>Histerometria:</strong> ${formatValue(data.hysterometry)} cm</div>
      <div class="item"><strong>Posição do Útero:</strong> ${formatValue(data.uterusPosition)} ${data.uterusPositionOther ? "- " + formatExtra(data.uterusPositionOther) : ""}</div>

      <div class="item"><strong>Analgesia Usada:</strong> Gel (${formatValue(data.gelUsed)}), Spray (${formatValue(data.sprayUsed)}), Injetável (${formatValue(data.injectableUsed)})</div>

      <div class="item-full"><strong>Intercorrências:</strong> ${formatValue(data.intercurrences)} ${data.notInsertedReason ? "(Motivo não inserido: " + formatExtra(data.notInsertedReason) + ")" : ""} ${data.otherIntercurrences ? "- " + formatExtra(data.otherIntercurrences) : ""}</div>
    </div>
  `;
}

export function buildAvaliacaoHtml(data) {
  return `
    <h2>4. Avaliação: Diagnóstico de Enfermagem (CIPE) e Planejamento</h2>
    <div class="grid">
      <div class="item-full"><strong>Diagnósticos:</strong> ${formatValue(data.diagnosis)} ${data.diagnosisOther ? "- " + formatExtra(data.diagnosisOther) : ""}</div>
      <div class="item-full"><strong>Resultados Esperados:</strong> ${formatValue(data.results)} ${data.resultsOther ? "- " + formatExtra(data.resultsOther) : ""}</div>
      <div class="item-full"><strong>Intervenções:</strong> ${formatValue(data.interventions)}</div>
      <div class="item-full"><strong>Outras Intervenções:</strong> ${formatValue(data.interventionsOther)}</div>
      <div class="item"><strong>Data do Acompanhamento (Retorno):</strong> ${formatDate(data.followUpDate)}</div>
      <div class="item"><strong>Local do Documento:</strong> ${formatValue(data.location)}</div>
      <div class="item"><strong>Data do Documento:</strong> ${formatDate(data.documentDate)}</div>
    </div>
  `;
}

export function openPrintWindow(bodyHtml) {
  const printContent = `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="utf-8">
      <title>Prontuário - Inserção de DIU</title>
      <style>${PRINT_STYLES}</style>
    </head>
    <body>
      <h1>Ficha Clínica - Consulta de Enfermagem (DIU)</h1>
      ${bodyHtml}
      <div class="footer">Assinatura e Carimbo do Profissional</div>
    </body>
    </html>
  `;

  const printWindow = window.open("", "_blank");
  if (!printWindow) return null;

  printWindow.document.write(printContent);
  printWindow.document.close();

  printWindow.onload = function () {
    printWindow.focus();
    printWindow.print();
  };

  return printWindow;
}
