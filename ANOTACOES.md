# Anotações do ProntDIU

Pontos levantados na revisão de 16/11/2026 que ficaram para decidir depois.

## Idade calculada pela data de hoje (decidir com as supervisoras)

**Como está:** o campo "Idade" da Triagem é calculado a partir da data de nascimento usando a data **de hoje** (`calculateAge` em `form-utils.js`), e é recalculado toda vez que o formulário é aberto.

**Consequência:** se uma triagem feita em 2026 for reaberta e salva de novo em 2027, a idade gravada muda (por exemplo, de 29 para 30), mesmo que nada tenha sido alterado. A idade impressa e exportada passa a ser a idade atual, não a idade da paciente no dia do atendimento.

**Alternativa:** calcular a idade em relação à **data da triagem** (campo "Data da triagem"). Assim o prontuário sempre mostra a idade que a paciente tinha no atendimento, que é o usual em registros clínicos e em dados de pesquisa.

**Pergunta para quem é da saúde:** a idade no prontuário deve ser a idade no dia da triagem (valor fixo) ou a idade atual da paciente?

A mudança no código é pequena nos dois casos; falta só a decisão.

## Adiado

- **Proteção dos dados sensíveis no dispositivo** (PIN ou criptografia): os dados ficam em claro no navegador. Deixado para depois.
