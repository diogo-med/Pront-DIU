# ProntDIU

Base de PWA para preenchimento da ficha clínica de consulta de enfermagem para inserção do DIU.

## O que já tem

- Formulário com as principais seções do prontuário.
- Auto-salvamento local no navegador.
- Lista de prontuários salvos, ordenada por data de criação, com abertura para edição.
	- Página dedicada `records.html` com listagem e exclusão de prontuários.
- Exportação em JSON.
- Instalação como PWA e suporte offline.
- Layout responsivo para uso em desktop e celular.

## Objetivo de cada arquivo

- `index.html`: página principal com a ficha clínica (formulário de atendimento) e ações de navegação.
- `app.js`: lógica da página principal; coleta/restaura dados do formulário, salva rascunho, cria/atualiza prontuários e registra o service worker.
- `records.html`: página de consulta dos prontuários salvos localmente.
- `records.js`: renderiza a lista de prontuários, permite abrir para edição e excluir registros.
- `styles.css`: estilos globais da interface (layout, componentes, responsividade e tema visual).
- `manifest.webmanifest`: metadados da PWA (nome, ícones, tema, modo de exibição e escopo).
- `sw.js`: service worker responsável por cache de assets e funcionamento offline.
- `vercel.json`: configuração de headers para deploy na Vercel, incluindo regras do service worker.
- `icons/icon.png`: ícone do aplicativo usado pela PWA e atalhos instalados.
- `README.md`: documentação do projeto, uso e visão geral da estrutura.

## Observação

As informações ficam salvas apenas no dispositivo do navegador, até o exportador JSON ser usado ou os dados serem apagados.
