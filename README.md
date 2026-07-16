# ProntDIU

Base de PWA para preenchimento da ficha clínica de consulta de enfermagem para inserção do DIU.

## O que já tem

- Formulário com as principais seções do prontuário.
- Auto-salvamento local no navegador.
- Exportação em JSON.
- Instalação como PWA e suporte offline.
- Layout responsivo para uso em desktop e celular.

## Como rodar

Sirva os arquivos por um servidor local, por exemplo com o Live Server do VS Code ou qualquer servidor estático.

## Observação

As informações ficam salvas apenas no dispositivo do navegador, até o exportador JSON ser usado ou os dados serem apagados.






quero que tenha uma página secundária que vai listar os prontuários que foram salvos nessa página os prontuários estarão listados sendo identificados pelo nome e ordenados pela data de criação para acessar essa página clica num botão "prontuários", caso a pessoa estivesse editando um prontuário as informações são salvas e redireciona para a página da lista.quero fazer uma alteração no bloco superior(que possui os botões "novo formulário" e imprimir pdf) e no bloco inferior(limpar prontuario, salvar rascunho e salvar prontuário) o bloco superior deixa de existir e o botão novo prontuário(salva as informações preenchidas e limpa o prontuário) fica no canto superior direito da página sem um bloco englobando o botão, enquanto o bloco inferior fica apenas com os botões salvar(deixar as informações salvas para uma possível edição futura), limpar formulário e imprimir(imprimir pdf)