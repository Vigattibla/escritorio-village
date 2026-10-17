import type { PhName } from '../components/ph'

/** Tipos de setor e os módulos de cada um. Um módulo é uma tela pronta (kanban, grade de quartos, livro de turno…)
 *  que guarda cartões em `registros`. Abas de um setor = abas antigas (agenda, plano…) + ids de módulo. */
export type CampoTipo = 'texto' | 'longo' | 'data' | 'hora' | 'num' | 'dinheiro' | 'pct' | 'sel' | 'tel' | 'pessoa' | 'check'
export interface Campo { id: string; nome: string; tipo: CampoTipo; ops?: string[]; card?: boolean }
export interface Etapa { id: string; nome: string; cor: string; fim?: boolean }
export type Layout = 'kanban' | 'grade' | 'diario' | 'semana' | 'rotina' | 'lista' | 'estoque'
export interface Modulo {
  id: string
  nome: string
  ic: PhName
  layout: Layout
  /** "Nova reserva", "Abrir chamado"… */
  novo: string
  /** rótulo do campo título */
  titulo: string
  desc: string
  status: Etapa[]
  campos: Campo[]
  /** campo de data que vira calendário */
  cal?: string
  /** campo de data que, vencido, marca o cartão em vermelho */
  prazo?: string
  /** outros setores podem abrir (chamado de manutenção, TI) */
  externo?: boolean
  /** texto de ajuda da caixa (diário) */
  dica?: string
}
export interface TipoSetor { id: string; nome: string; desc: string; abas: string[] }

const C = { cinza: '#7A8499', azul: '#2440FF', amarelo: '#E0A100', verde: '#16A34A', roxo: '#7C3AED', vermelho: '#DC2626', grafite: '#4B5263', laranja: '#EA6A12' }
const obs: Campo = { id: 'obs', nome: 'Observações', tipo: 'longo' }
const tel: Campo = { id: 'tel', nome: 'Telefone', tipo: 'tel' }
const URG = ['Baixa', 'Média', 'Alta', 'Urgente']

export const MODULOS: Modulo[] = [
  {
    id: 'reservas', nome: 'Reservas', ic: 'calendar-blank', layout: 'kanban', novo: 'Nova reserva', titulo: 'Hóspede', cal: 'entrada',
    desc: 'Do primeiro contato ao check-in. Arraste o cartão entre as etapas.',
    status: [{ id: 'contato', nome: 'Contato', cor: C.cinza }, { id: 'cotacao', nome: 'Cotação enviada', cor: C.azul }, { id: 'pagamento', nome: 'Aguardando pagamento', cor: C.amarelo }, { id: 'confirmada', nome: 'Confirmada', cor: C.verde }, { id: 'hospedado', nome: 'Hospedado', cor: C.roxo, fim: true }, { id: 'perdida', nome: 'Perdida', cor: C.vermelho, fim: true }],
    campos: [{ ...tel, card: true }, { id: 'entrada', nome: 'Entrada', tipo: 'data', card: true }, { id: 'saida', nome: 'Saída', tipo: 'data', card: true }, { id: 'adultos', nome: 'Adultos', tipo: 'num' }, { id: 'criancas', nome: 'Crianças', tipo: 'num' }, { id: 'quarto', nome: 'Quarto / tipo', tipo: 'texto', card: true },
      { id: 'canal', nome: 'Canal', tipo: 'sel', ops: ['WhatsApp', 'Telefone', 'Site', 'Instagram', 'Booking', 'Agência', 'Balcão'], card: true }, { id: 'valor', nome: 'Valor', tipo: 'dinheiro', card: true }, obs],
  },
  {
    id: 'retornos', nome: 'Retornos', ic: 'bell-simple', layout: 'lista', novo: 'Novo retorno', titulo: 'Nome', prazo: 'quando',
    desc: 'Quem pediu pra ligar de volta. Vencido fica vermelho.',
    status: [{ id: 'aberto', nome: 'Ligar', cor: C.amarelo }, { id: 'sem', nome: 'Sem resposta', cor: C.cinza }, { id: 'feito', nome: 'Retornado', cor: C.verde, fim: true }],
    campos: [{ ...tel, card: true }, { id: 'quando', nome: 'Retornar em', tipo: 'data', card: true }, { id: 'assunto', nome: 'Assunto', tipo: 'texto', card: true }, obs],
  },
  {
    id: 'chegadas', nome: 'Chegadas', ic: 'person-simple-walk', layout: 'kanban', novo: 'Nova chegada', titulo: 'Hóspede', cal: 'entrada',
    desc: 'Quem chega e quem sai. Check-in e check-out num lugar só.',
    status: [{ id: 'previsto', nome: 'Previsto', cor: C.cinza }, { id: 'chegou', nome: 'Check-in feito', cor: C.verde }, { id: 'saiu', nome: 'Check-out', cor: C.azul, fim: true }, { id: 'noshow', nome: 'Não veio', cor: C.vermelho, fim: true }],
    campos: [{ id: 'quarto', nome: 'Quarto', tipo: 'texto', card: true }, { id: 'entrada', nome: 'Entrada', tipo: 'data', card: true }, { id: 'saida', nome: 'Saída', tipo: 'data', card: true }, { id: 'pessoas', nome: 'Pessoas', tipo: 'num', card: true }, tel, obs],
  },
  {
    id: 'turno', nome: 'Passagem de turno', ic: 'note-blank', layout: 'diario', novo: 'Anotar', titulo: 'Recado',
    desc: 'Livro do turno: o que o próximo precisa saber. Marque "Li" quando ler.',
    status: [{ id: 'nota', nome: 'Recado', cor: C.cinza }, { id: 'pendente', nome: 'Pendência', cor: C.amarelo }, { id: 'resolvido', nome: 'Resolvido', cor: C.verde, fim: true }],
    campos: [{ id: 'turno', nome: 'Turno', tipo: 'sel', ops: ['Manhã', 'Tarde', 'Noite'], card: true }],
  },
  {
    id: 'achados', nome: 'Achados e perdidos', ic: 'magnifying-glass', layout: 'lista', novo: 'Registrar objeto', titulo: 'Objeto',
    desc: 'O que foi encontrado, onde está guardado e quem levou.',
    status: [{ id: 'guardado', nome: 'Guardado', cor: C.azul }, { id: 'devolvido', nome: 'Devolvido', cor: C.verde, fim: true }, { id: 'descartado', nome: 'Descartado', cor: C.cinza, fim: true }],
    campos: [{ id: 'local', nome: 'Onde achou', tipo: 'texto', card: true }, { id: 'data', nome: 'Quando', tipo: 'data', card: true }, { id: 'guarda', nome: 'Onde está guardado', tipo: 'texto', card: true }, { id: 'dono', nome: 'Dono / contato', tipo: 'texto' }, obs],
  },
  {
    id: 'rotina', nome: 'Rotina', ic: 'list-checks', layout: 'rotina', novo: 'Nova tarefa da rotina', titulo: 'Tarefa',
    desc: 'O checklist de todo dia. Marca quem fez e a hora; amanhã começa zerado.',
    status: [{ id: 'ativo', nome: 'Ativa', cor: C.azul }],
    campos: [{ id: 'turno', nome: 'Quando', tipo: 'sel', ops: ['Abertura', 'Manhã', 'Tarde', 'Noite', 'Fechamento'], card: true }, { id: 'resp', nome: 'Quem costuma fazer', tipo: 'pessoa', card: true }],
  },
  {
    id: 'uhs', nome: 'Quartos', ic: 'bed', layout: 'grade', novo: 'Adicionar quartos', titulo: 'Quarto',
    desc: 'Situação de cada quarto. Toque no quarto para mudar.',
    status: [{ id: 'suja', nome: 'Sujo', cor: C.vermelho }, { id: 'limpando', nome: 'Em limpeza', cor: C.amarelo }, { id: 'limpa', nome: 'Limpo', cor: C.verde }, { id: 'inspecionada', nome: 'Vistoriado', cor: C.azul }, { id: 'ocupada', nome: 'Ocupado', cor: C.roxo }, { id: 'bloqueada', nome: 'Bloqueado', cor: C.grafite }],
    campos: [{ id: 'bloco', nome: 'Bloco / andar', tipo: 'texto', card: true }, { id: 'camareira', nome: 'Camareira', tipo: 'pessoa', card: true }, obs],
  },
  {
    id: 'estoque', nome: 'Estoque', ic: 'squares-four', layout: 'estoque', novo: 'Novo item', titulo: 'Item',
    desc: 'Quanto tem de cada coisa. Abaixo do mínimo fica marcado.',
    status: [{ id: 'ok', nome: 'Ok', cor: C.verde }],
    campos: [{ id: 'qtd', nome: 'Quantidade', tipo: 'num', card: true }, { id: 'min', nome: 'Mínimo', tipo: 'num', card: true }, { id: 'unid', nome: 'Unidade', tipo: 'sel', ops: ['un', 'cx', 'pct', 'kg', 'L', 'rolo', 'par'], card: true }, { id: 'local', nome: 'Onde fica', tipo: 'texto' }],
  },
  {
    id: 'compras', nome: 'Compras', ic: 'storefront', layout: 'kanban', novo: 'Pedir compra', titulo: 'O que comprar', prazo: 'previsao',
    desc: 'Do pedido à entrega: o que falta, quem está cotando e quando chega.',
    status: [{ id: 'pedir', nome: 'A pedir', cor: C.cinza }, { id: 'cotando', nome: 'Cotando', cor: C.amarelo }, { id: 'pedido', nome: 'Pedido feito', cor: C.azul }, { id: 'chegou', nome: 'Chegou', cor: C.verde, fim: true }],
    campos: [{ id: 'qtd', nome: 'Quantidade', tipo: 'texto', card: true }, { id: 'fornecedor', nome: 'Fornecedor', tipo: 'texto', card: true }, { id: 'valor', nome: 'Valor', tipo: 'dinheiro', card: true }, { id: 'previsao', nome: 'Chega em', tipo: 'data', card: true }, obs],
  },
  {
    id: 'os', nome: 'Chamados', ic: 'gear-six', layout: 'kanban', novo: 'Abrir chamado', titulo: 'O que aconteceu', externo: true, prazo: 'prazo',
    desc: 'Ordens de serviço da manutenção. Qualquer setor abre pelo Pedidos.',
    status: [{ id: 'aberta', nome: 'Aberto', cor: C.vermelho }, { id: 'atendimento', nome: 'Em atendimento', cor: C.amarelo }, { id: 'peca', nome: 'Aguardando peça', cor: C.roxo }, { id: 'resolvida', nome: 'Resolvido', cor: C.verde, fim: true }],
    campos: [{ id: 'local', nome: 'Onde', tipo: 'texto', card: true }, { id: 'cat', nome: 'Tipo', tipo: 'sel', ops: ['Elétrica', 'Hidráulica', 'Ar-condicionado', 'Pintura', 'Marcenaria', 'Alvenaria', 'Piscina', 'Jardim', 'Outro'], card: true },
      { id: 'urg', nome: 'Urgência', tipo: 'sel', ops: URG, card: true }, { id: 'resp', nome: 'Responsável', tipo: 'pessoa', card: true }, { id: 'prazo', nome: 'Prazo', tipo: 'data' }, obs],
  },
  {
    id: 'ti', nome: 'Chamados de TI', ic: 'keyboard', layout: 'kanban', novo: 'Abrir chamado de TI', titulo: 'O que aconteceu', externo: true,
    desc: 'Computador, internet, impressora, sistema. Qualquer setor abre pelo Pedidos.',
    status: [{ id: 'aberta', nome: 'Aberto', cor: C.vermelho }, { id: 'atendimento', nome: 'Em atendimento', cor: C.amarelo }, { id: 'terceiro', nome: 'Com fornecedor', cor: C.roxo }, { id: 'resolvida', nome: 'Resolvido', cor: C.verde, fim: true }],
    campos: [{ id: 'local', nome: 'Onde / equipamento', tipo: 'texto', card: true }, { id: 'cat', nome: 'Tipo', tipo: 'sel', ops: ['Computador', 'Impressora', 'Internet / Wi-Fi', 'Sistema', 'Telefone', 'E-mail', 'Acesso / senha', 'Outro'], card: true },
      { id: 'urg', nome: 'Urgência', tipo: 'sel', ops: URG, card: true }, { id: 'resp', nome: 'Responsável', tipo: 'pessoa', card: true }, obs],
  },
  {
    id: 'obras', nome: 'Obras', ic: 'building-office', layout: 'kanban', novo: 'Nova obra', titulo: 'Obra', cal: 'previsao', prazo: 'previsao',
    desc: 'Cada obra com avanço, orçamento e gasto. Atrasada fica vermelha.',
    status: [{ id: 'planejada', nome: 'Planejada', cor: C.cinza }, { id: 'andamento', nome: 'Em andamento', cor: C.azul }, { id: 'parada', nome: 'Parada', cor: C.vermelho }, { id: 'vistoria', nome: 'Vistoria', cor: C.amarelo }, { id: 'concluida', nome: 'Concluída', cor: C.verde, fim: true }],
    campos: [{ id: 'local', nome: 'Local', tipo: 'texto', card: true }, { id: 'resp', nome: 'Responsável', tipo: 'pessoa', card: true }, { id: 'inicio', nome: 'Início', tipo: 'data' }, { id: 'previsao', nome: 'Previsão de entrega', tipo: 'data', card: true },
      { id: 'avanco', nome: 'Avanço', tipo: 'pct', card: true }, { id: 'orcamento', nome: 'Orçamento', tipo: 'dinheiro', card: true }, { id: 'gasto', nome: 'Gasto até agora', tipo: 'dinheiro' }, { id: 'fornecedor', nome: 'Empreiteiro / fornecedor', tipo: 'texto' }, obs],
  },
  {
    id: 'eventos', nome: 'Eventos', ic: 'confetti', layout: 'kanban', novo: 'Novo evento', titulo: 'Evento', cal: 'data',
    desc: 'Casamentos, aniversários, empresas: da consulta ao dia do evento.',
    status: [{ id: 'consulta', nome: 'Consulta', cor: C.cinza }, { id: 'proposta', nome: 'Proposta enviada', cor: C.azul }, { id: 'fechado', nome: 'Fechado', cor: C.verde }, { id: 'realizado', nome: 'Realizado', cor: C.roxo, fim: true }, { id: 'cancelado', nome: 'Cancelado', cor: C.vermelho, fim: true }],
    campos: [{ id: 'cliente', nome: 'Cliente', tipo: 'texto', card: true }, { id: 'data', nome: 'Data', tipo: 'data', card: true }, { id: 'convidados', nome: 'Convidados', tipo: 'num', card: true },
      { id: 'espaco', nome: 'Espaço', tipo: 'sel', ops: ['Salão', 'Área da piscina', 'Gramado', 'Restaurante', 'Quiosque', 'Outro'], card: true }, { id: 'valor', nome: 'Valor', tipo: 'dinheiro', card: true }, tel, obs],
  },
  {
    id: 'programacao', nome: 'Programação', ic: 'smiley', layout: 'semana', novo: 'Nova atividade', titulo: 'Atividade',
    desc: 'A semana da recreação: o que, onde, que horas e pra qual turma.',
    status: [{ id: 'ok', nome: 'Programada', cor: C.azul }, { id: 'cancelada', nome: 'Cancelada', cor: C.cinza, fim: true }],
    campos: [{ id: 'dia', nome: 'Dia', tipo: 'data' }, { id: 'hora', nome: 'Hora', tipo: 'hora', card: true }, { id: 'local', nome: 'Local', tipo: 'texto', card: true },
      { id: 'publico', nome: 'Turma', tipo: 'sel', ops: ['Todas as idades', '04 a 07', '08 a 12', 'Adolescentes', 'Adultos', 'Família'], card: true }, { id: 'resp', nome: 'Monitor', tipo: 'pessoa', card: true }],
  },
  {
    id: 'contas', nome: 'Contas', ic: 'file-text', layout: 'kanban', novo: 'Nova conta', titulo: 'Conta', cal: 'venc', prazo: 'venc',
    desc: 'A pagar e a receber por vencimento. Vencida fica vermelha.',
    status: [{ id: 'pagar', nome: 'A pagar', cor: C.amarelo }, { id: 'receber', nome: 'A receber', cor: C.azul }, { id: 'pago', nome: 'Pago / recebido', cor: C.verde, fim: true }],
    campos: [{ id: 'valor', nome: 'Valor', tipo: 'dinheiro', card: true }, { id: 'venc', nome: 'Vencimento', tipo: 'data', card: true }, { id: 'fornecedor', nome: 'Fornecedor / cliente', tipo: 'texto', card: true },
      { id: 'cat', nome: 'Categoria', tipo: 'sel', ops: ['Fornecedor', 'Folha', 'Imposto', 'Manutenção', 'Marketing', 'Hóspede', 'Evento', 'Outro'] }, obs],
  },
  {
    id: 'admissao', nome: 'Contratações', ic: 'users-three', layout: 'kanban', novo: 'Novo candidato', titulo: 'Candidato',
    desc: 'Da vaga aberta ao primeiro dia: triagem, entrevista e documentos.',
    status: [{ id: 'triagem', nome: 'Triagem', cor: C.cinza }, { id: 'entrevista', nome: 'Entrevista', cor: C.azul }, { id: 'docs', nome: 'Documentação', cor: C.amarelo }, { id: 'contratado', nome: 'Contratado', cor: C.verde, fim: true }, { id: 'nao', nome: 'Não seguiu', cor: C.vermelho, fim: true }],
    campos: [{ id: 'cargo', nome: 'Cargo', tipo: 'texto', card: true }, { id: 'setor', nome: 'Setor', tipo: 'texto', card: true }, tel, { id: 'inicio', nome: 'Começa em', tipo: 'data', card: true }, obs],
  },
  {
    id: 'leads', nome: 'Funil', ic: 'target', layout: 'kanban', novo: 'Novo contato', titulo: 'Contato', prazo: 'retorno',
    desc: 'Empresas, agências e grupos: do primeiro contato ao fechamento.',
    status: [{ id: 'novo', nome: 'Novo', cor: C.cinza }, { id: 'contato', nome: 'Em contato', cor: C.azul }, { id: 'proposta', nome: 'Proposta', cor: C.amarelo }, { id: 'negociacao', nome: 'Negociação', cor: C.laranja }, { id: 'ganho', nome: 'Fechado', cor: C.verde, fim: true }, { id: 'perdido', nome: 'Perdido', cor: C.vermelho, fim: true }],
    campos: [{ id: 'empresa', nome: 'Empresa', tipo: 'texto', card: true }, tel, { id: 'origem', nome: 'Origem', tipo: 'sel', ops: ['Indicação', 'Instagram', 'Site', 'Feira', 'Agência', 'Prospecção'], card: true }, { id: 'valor', nome: 'Valor', tipo: 'dinheiro', card: true }, { id: 'retorno', nome: 'Próximo contato', tipo: 'data', card: true }, obs],
  },
  {
    id: 'diarioobra', nome: 'Diário de obra', ic: 'pencil-simple-line', layout: 'diario', novo: 'Anotar', titulo: 'Registro', dica: 'Como foi hoje? Equipe, serviço feito, clima, material que chegou, problema…',
    desc: 'O dia a dia da obra: quem trabalhou, o que avançou e o que travou.',
    status: [{ id: 'nota', nome: 'Registro', cor: C.cinza }, { id: 'pendente', nome: 'Problema', cor: C.laranja }, { id: 'resolvido', nome: 'Resolvido', cor: C.verde, fim: true }],
    campos: [{ id: 'turno', nome: 'Período', tipo: 'sel', ops: ['Manhã', 'Tarde'], card: true }],
  },
  {
    id: 'avisos', nome: 'Mural de avisos', ic: 'megaphone', layout: 'diario', novo: 'Avisar', titulo: 'Aviso', dica: 'Aviso pra todo mundo do setor (escala, reunião, regra nova…)',
    desc: 'Recado pra equipe toda. Cada um marca "Li".',
    status: [{ id: 'nota', nome: 'Aviso', cor: C.azul }, { id: 'pendente', nome: 'Importante', cor: C.vermelho }, { id: 'resolvido', nome: 'Encerrado', cor: C.cinza, fim: true }],
    campos: [{ id: 'turno', nome: 'Para', tipo: 'sel', ops: [], card: true }],
  },
  {
    id: 'cardapio', nome: 'Cardápio da semana', ic: 'coffee', layout: 'semana', novo: 'Novo prato', titulo: 'Prato',
    desc: 'O que sai em cada refeição. Copie pro grupo da equipe com um toque.',
    status: [{ id: 'ok', nome: 'No cardápio', cor: C.verde }, { id: 'cancelada', nome: 'Trocado', cor: C.cinza, fim: true }],
    campos: [{ id: 'dia', nome: 'Dia', tipo: 'data' }, { id: 'hora', nome: 'Horário', tipo: 'hora', card: true },
      { id: 'publico', nome: 'Refeição', tipo: 'sel', ops: ['Café da manhã', 'Almoço', 'Lanche', 'Jantar', 'Evento'], card: true },
      { id: 'local', nome: 'Onde', tipo: 'sel', ops: ['Restaurante', 'Bar da piscina', 'Quiosque', 'Salão de eventos', 'Room service'], card: true },
      { id: 'resp', nome: 'Cozinheiro', tipo: 'pessoa', card: true }, obs],
  },
  {
    id: 'escala', nome: 'Escala', ic: 'calendar-dots', layout: 'semana', novo: 'Novo turno', titulo: 'Função',
    desc: 'Quem trabalha em cada dia e horário. Repita a semana anterior e ajuste.',
    status: [{ id: 'ok', nome: 'Escalado', cor: C.azul }, { id: 'cancelada', nome: 'Folga / falta', cor: C.cinza, fim: true }],
    campos: [{ id: 'dia', nome: 'Dia', tipo: 'data' }, { id: 'hora', nome: 'Entrada', tipo: 'hora', card: true }, { id: 'resp', nome: 'Pessoa', tipo: 'pessoa', card: true },
      { id: 'local', nome: 'Posto', tipo: 'texto', card: true }, { id: 'publico', nome: 'Turno', tipo: 'sel', ops: ['Manhã', 'Tarde', 'Noite', 'Intermediário'], card: true }, obs],
  },
  {
    id: 'grupos', nome: 'Grupos e bloqueios', ic: 'users-three', layout: 'kanban', novo: 'Novo grupo', titulo: 'Grupo / empresa', cal: 'entrada', prazo: 'opcao',
    desc: 'Grupos, empresas e casamentos: bloqueio de quartos até o contrato.',
    status: [{ id: 'consulta', nome: 'Consulta', cor: C.cinza }, { id: 'bloqueio', nome: 'Bloqueio', cor: C.amarelo }, { id: 'contrato', nome: 'Contrato assinado', cor: C.verde }, { id: 'hospedado', nome: 'Hospedado', cor: C.roxo, fim: true }, { id: 'cancelado', nome: 'Cancelado', cor: C.vermelho, fim: true }],
    campos: [{ id: 'resp', nome: 'Contato', tipo: 'texto', card: true }, { ...tel }, { id: 'entrada', nome: 'Entrada', tipo: 'data', card: true }, { id: 'saida', nome: 'Saída', tipo: 'data' },
      { id: 'quartos', nome: 'Quartos bloqueados', tipo: 'num', card: true }, { id: 'pessoas', nome: 'Pessoas', tipo: 'num' }, { id: 'opcao', nome: 'Opção vale até', tipo: 'data', card: true },
      { id: 'valor', nome: 'Valor total', tipo: 'dinheiro', card: true }, obs],
  },
  {
    id: 'pedhosp', nome: 'Pedidos do hóspede', ic: 'bell', layout: 'kanban', novo: 'Novo pedido', titulo: 'Pedido', externo: true,
    desc: 'Toalha, berço, transfer, late check-out… do pedido ao atendido.',
    status: [{ id: 'aberto', nome: 'Pedido', cor: C.amarelo }, { id: 'andamento', nome: 'Encaminhado', cor: C.azul }, { id: 'feito', nome: 'Atendido', cor: C.verde, fim: true }],
    campos: [{ id: 'quarto', nome: 'Quarto', tipo: 'texto', card: true }, { id: 'tipo', nome: 'Tipo', tipo: 'sel', ops: ['Enxoval', 'Berço / cama extra', 'Manutenção', 'Transfer', 'Late check-out', 'Restaurante', 'Outro'], card: true },
      { id: 'quando', nome: 'Para quando', tipo: 'hora', card: true }, { id: 'resp', nome: 'Quem atende', tipo: 'pessoa', card: true }, obs],
  },
  {
    id: 'ferias', nome: 'Férias e folgas', ic: 'calendar-blank', layout: 'lista', novo: 'Novo pedido', titulo: 'Pessoa', cal: 'inicio',
    desc: 'Pedidos de férias, folga e banco de horas, com quem cobre.',
    status: [{ id: 'pedido', nome: 'Pedido', cor: C.amarelo }, { id: 'aprovado', nome: 'Aprovado', cor: C.verde }, { id: 'gozado', nome: 'Gozado', cor: C.cinza, fim: true }, { id: 'negado', nome: 'Negado', cor: C.vermelho, fim: true }],
    campos: [{ id: 'tipo', nome: 'Tipo', tipo: 'sel', ops: ['Férias', 'Folga', 'Banco de horas', 'Atestado', 'Licença'], card: true }, { id: 'inicio', nome: 'De', tipo: 'data', card: true }, { id: 'fim', nome: 'Até', tipo: 'data', card: true },
      { id: 'cobre', nome: 'Quem cobre', tipo: 'pessoa', card: true }, obs],
  },
]
export const MOD: Record<string, Modulo> = Object.fromEntries(MODULOS.map(m => [m.id, m]))

const P = ['pedidos']
export const TIPOS: TipoSetor[] = [
  { id: 'marketing', nome: 'Marketing', desc: 'Quadro, plano, publicações e legendas', abas: ['agenda', 'plano', 'redes', 'legendas', 'arquivos', ...P] },
  { id: 'comercial', nome: 'Comercial / Vendas', desc: 'Funil de contatos, eventos e retornos', abas: ['leads', 'grupos', 'eventos', 'retornos', 'agenda', 'arquivos', ...P] },
  { id: 'reservas', nome: 'Central de reservas', desc: 'Reservas do contato ao check-in, grupos, retornos e livro de turno', abas: ['reservas', 'grupos', 'retornos', 'turno', 'agenda', 'arquivos', ...P] },
  { id: 'recepcao', nome: 'Recepção', desc: 'Chegadas e saídas, pedidos do hóspede, livro de turno, achados', abas: ['chegadas', 'pedhosp', 'turno', 'achados', 'rotina', ...P] },
  { id: 'governanca', nome: 'Governança', desc: 'Situação dos quartos, rotina, enxoval e achados', abas: ['uhs', 'rotina', 'estoque', 'achados', 'turno', ...P] },
  { id: 'manutencao', nome: 'Manutenção', desc: 'Chamados, preventiva, peças e livro de turno', abas: ['os', 'rotina', 'estoque', 'compras', 'turno', ...P] },
  { id: 'obras', nome: 'Obras e projetos', desc: 'Obras com avanço e orçamento, diário de obra, compras e chamados', abas: ['obras', 'diarioobra', 'compras', 'os', 'agenda', 'arquivos', ...P] },
  { id: 'eventos', nome: 'Eventos', desc: 'Eventos da consulta ao dia, rotina de montagem', abas: ['eventos', 'rotina', 'compras', 'agenda', 'arquivos', ...P] },
  { id: 'ab', nome: 'Alimentos e bebidas', desc: 'Cardápio da semana, rotina da cozinha, estoque, escala e turno', abas: ['cardapio', 'rotina', 'estoque', 'compras', 'escala', 'turno', ...P] },
  { id: 'recreacao', nome: 'Recreação', desc: 'Programação da semana, rotina e materiais', abas: ['programacao', 'rotina', 'estoque', 'agenda', ...P] },
  { id: 'rh', nome: 'RH / Pessoas', desc: 'Contratações, escala, férias e mural de avisos', abas: ['admissao', 'escala', 'ferias', 'avisos', 'agenda', 'arquivos', ...P] },
  { id: 'financeiro', nome: 'Financeiro', desc: 'Contas a pagar e a receber, compras', abas: ['contas', 'compras', 'agenda', 'arquivos', ...P] },
  { id: 'ti', nome: 'TI', desc: 'Chamados de TI, rotina e equipamentos', abas: ['ti', 'rotina', 'estoque', 'arquivos', ...P] },
  { id: 'geral', nome: 'Geral', desc: 'Mural de avisos, agenda, arquivos e pedidos', abas: ['avisos', 'agenda', 'arquivos', ...P] },
]
export const TIPO: Record<string, TipoSetor> = Object.fromEntries(TIPOS.map(t => [t.id, t]))

const REGRAS: [RegExp, string][] = [
  [/market|comunica|social|mkt|midia/, 'marketing'], [/reserva|central/, 'reservas'], [/comerc|vend/, 'comercial'], [/recep|front|portaria/, 'recepcao'],
  [/govern|camar|limpeza|housekeep|lavand/, 'governanca'], [/manut/, 'manutencao'], [/obra|engenh|constru/, 'obras'], [/evento/, 'eventos'],
  [/a ?& ?b|\baeb\b|aliment|bebida|cozinha|restaur|\bbar\b/, 'ab'], [/recrea|lazer|kids|monitor/, 'recreacao'], [/\brh\b|recursos humanos|pessoas|\bdp\b/, 'rh'],
  [/financ|contab|fatur|tesour/, 'financeiro'], [/\bti\b|tecnolog|informat|sistemas/, 'ti'],
]
const sem = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
/** tipo marcado na sala ou deduzido pelo nome (Marketing antigo = marketing) */
export function tipoId(d: { id: string; name: string; tipo?: string | null; vendas?: boolean }) {
  if (d.tipo && TIPO[d.tipo]) return d.tipo
  const n = sem(`${d.name} ${d.id}`)
  for (const [re, t] of REGRAS) if (re.test(n)) return t
  return d.vendas ? 'comercial' : 'geral'
}
export const tipoDe = (d: { id: string; name: string; tipo?: string | null; vendas?: boolean }) => TIPO[tipoId(d)]
