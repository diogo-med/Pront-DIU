# ProntDIU

PWA para preenchimento da ficha clínica de consulta de enfermagem para inserção do DIU. Funciona offline e guarda os dados apenas no dispositivo.

## Como funciona

O prontuário é dividido em duas etapas, que podem acontecer em dias (e dispositivos) diferentes:

- **Triagem** (`index.html`): identificação, motivação, antecedentes e escolha contraceptiva.
- **Inserção** (`insercao.html`): exame físico, inserção do DIU, intercorrências, diagnóstico, resultados e intervenções.

Na lista de prontuários (`records.html`), "Ir para Inserção" continua o prontuário de uma triagem já salva. "Nova Inserção" cria uma inserção solta, que pode receber os dados da paciente importando o JSON exportado da triagem em outro dispositivo.

## Recursos

- Auto-salvamento do rascunho enquanto se digita, inclusive ao editar um prontuário já salvo; o cabeçalho mostra o que está sendo editado e o horário do último rascunho.
- Pergunta de confirmação antes de qualquer ação que apague ou descarte dados.
- Lista de prontuários com busca por nome ou número.
- Impressão (PDF) da triagem, da inserção ou das duas juntas.
- Exportações por prontuário: JSON da triagem, CSV (uma linha, sem cabeçalho e sem os campos de identificação) e texto formatado.
- Exportação de todos os prontuários em um único CSV (com cabeçalho).
- Backup de todos os prontuários em JSON e restauração do backup.
- Ao salvar um arquivo, o app deixa escolher o destino quando o navegador permite (janela "Salvar como" no computador; menu de compartilhamento no celular).
- Instalação como PWA e uso totalmente offline.

## Arquivos

- `index.html` / `app.js`: página e lógica da Triagem.
- `insercao.html` / `insercao.js`: página e lógica da Inserção.
- `records.html` / `records.js`: lista de prontuários, busca, exportações, backup e exclusão.
- `form-page.js`: lógica comum às duas páginas de formulário (auto-salvamento, status do cabeçalho, pergunta de exclusão após imprimir).
- `form-utils.js`: leitura/preenchimento dos campos, máscaras, cálculos automáticos (idade e IMC) e registro do service worker.
- `db.js`: armazenamento local em IndexedDB (prontuários e rascunhos) e migrações de versões anteriores.
- `print.js`: monta o documento de impressão.
- `export.js`: gera CSV, texto e backup, e salva arquivos.
- `ui.js`: utilidades de interface (toast, formatação de datas, nome exibido).
- `styles.css`: estilos da interface.
- `sw.js`: service worker; serve os arquivos do cache e os atualiza em segundo plano quando há rede.
- `manifest.webmanifest`: metadados da PWA.
- `vercel.json`: cabeçalhos para deploy na Vercel.
- `ANOTACOES.md`: decisões pendentes e pontos para revisar depois.

## Rodando localmente

Não há etapa de build. Sirva a pasta com qualquer servidor estático, por exemplo:

```
python3 -m http.server 8000
```

e abra `http://localhost:8000`.

## Observação sobre os dados

Os prontuários ficam salvos apenas no navegador do dispositivo, sem servidor. Eles podem ser perdidos se os dados do site forem limpos ou o app for desinstalado, então vale fazer o backup (JSON) periodicamente pela lista de prontuários.
