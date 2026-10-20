import type { MesaFn, MesaPedido, MesaResposta } from '../supabase/functions/_shared/jogos/mesa.ts'
import type { Escolha, JogoCassino, Rodada } from './cassino/regras'
import type { Bolao } from './cassino/bolao'
import type { Bingo } from './cassino/bingo'
import type { Bloqueio } from './game/vigia'
export type Dir = 'down' | 'up' | 'left' | 'right'
/** básicos: camiseta, moletom, social, vestido, terno; o resto vem do Almoxarifado */
export type Outfit = string
/** básicos: curto, longo, coque, cacheado, raspado; o resto vem do Almoxarifado */
export type HairStyle = string
/** o que vai além da roupa: cabeça, rosto, mesa e companhia (valor = arte do item) */
export type GearSlot = 'chapeu' | 'rosto' | 'mesa' | 'cadeira' | 'notebook' | 'enfeite' | 'chao' | 'arquivo' | 'animacao' | 'plaquinha' | 'pet' | 'montaria' | 'acao'
export type Gear = Partial<Record<GearSlot, string>>

export interface Avatar {
  skin: string
  hair: HairStyle
  hairColor: string
  outfit: Outfit
  top: string
  bottom: string
  shoes: string
  face: 'pixel' | 'foto'
  pixelPhoto: boolean
  /** itens do Almoxarifado em uso */
  gear?: Gear
}

/** cafezinhos: extrato só da própria pessoa; itens comprados = linhas 'compra' */
export interface CoffeeLine { amount: number; reason: 'dia' | 'boasvindas' | 'fase' | 'meta' | 'compra' | 'aposta' | 'premio' | 'bilhete' | 'bolao' | 'troca' | 'bingo' | 'poder' | 'coringa' | 'mesada' | 'casa' | 'torneio' | 'presente' | 'desafio'; ref: string; created_at: string }
export interface Wallet { balance: number; owned: string[]; log: CoffeeLine[]; latinhas: number }

export interface Profile {
  id: string
  name: string
  role: string
  avatar: Avatar | null
  photo: string | null
  xp: number
  desk: number
  /** 1 Equipe · 2 Coordenação · 3 Gerência · 4 Chefe — só muda por setRank */
  rank: number
  /** adm: cria contas, troca senhas e define cargos (não é o mesmo que Chefe) */
  is_admin?: boolean
  /** dono do Estúdio (a conversa é só dele) */
  estudio_dono?: boolean
  /** aprova as peças do Estúdio (o dono marca) */
  aprova_estudio?: boolean
  /** sala (departamento); só o adm ou a Chefe muda (setDept) */
  dept?: string
  /** conta do cassino: só joga e cuida do cassino (só o adm marca; fora das salas e do quadro) */
  cassino?: boolean
  created_at: string
}

/** torneio do cassino: maior lucro no período leva o prêmio (que sai do bolso da conta do cassino) */
export interface Torneio {
  id: string
  criado_por: string
  jogo: 'todos' | JogoCassino
  premio: number
  inicio: string
  fim: string
  estado: 'aberto' | 'pago' | 'devolvido' | 'cancelado'
  vencedor: string | null
  lucro: number | null
  created_at?: string
  placar?: { u: string; lucro: number; rodadas: number }[]
}
/** números da casa: só a conta do cassino e o adm recebem */
export interface CasaHoje { perdido: number; pago: number; teto: number; mesada: number; semana: number; mesAberto: number; podeMudar: boolean }
/** taxa = imposto do gerente (0–15%) sobre as apostas perdidas */
export interface CassinoPainel { torneio: Torneio | null; historico: Torneio[]; taxa: number; casa: CasaHoje | null }

/** inbox = pedido esperando aceite (fica no computador); review = esperando o mestre do projeto aprovar; declined = recusado */
export type TaskStatus = 'inbox' | 'todo' | 'doing' | 'review' | 'done' | 'declined'

/** Projeto: agrupa tarefas de várias pessoas; o mestre aprova ou reprova as entregas. */
export interface Project {
  id: string
  name: string
  /** mestre (dono) do projeto: aprova as entregas */
  master_id: string
  /** critérios de aprovação que valem para todas as tarefas do projeto */
  criteria: string[]
  color: string
  archived: boolean
  created_by: string
  created_at: string
  /** pasta do Drive do projeto (as tarefas sem pasta usam esta) */
  drive?: DriveLink | null
  dept?: string
}

/** pasta do Drive ligada a tarefa/projeto: caminho desde a raiz "Escritório Village" (o servidor confere cada passo) */
export interface DriveLink { crumbs: { id: string; name: string }[] }

/** Uma decisão do aprovador (fica o histórico na tarefa). */
export interface Review {
  by: string
  at: string
  ok: boolean
  /** justificativa (obrigatória ao reprovar) */
  reason: string
  /** critérios que não passaram */
  failed: string[]
}

export interface Task {
  id: string
  owner_id: string
  created_by: string
  title: string
  /** descrição / legenda */
  notes: string
  status: TaskStatus
  start: string | null
  due: string | null
  /** quem ajuda (a tarefa aparece na pasta dessas pessoas também) */
  collaborators: string[]
  attachments: Attachment[]
  position: number
  created_at: string
  done_at: string | null
  project_id: string | null
  /** critérios extras só desta tarefa (somam com os do projeto) */
  criteria: string[]
  reviews: Review[]
  priority: Priority | null
  checklist: CheckItem[]
  /** lembrete para o dono (ISO) */
  remind_at: string | null
  /** horário de entrega junto do prazo ("HH:MM") */
  due_time?: string | null
  /** post: canal e horário de publicar (vai para a Agenda) */
  channel: Channel | null
  publish_at: string | null
  /** etapa personalizada do quadro (null = primeira etapa do tipo do status) */
  stage?: string | null
  /** pasta do Drive desta tarefa */
  drive?: DriveLink | null
  /** sala de quem é responsável (o banco decide) */
  dept?: string
  /** pedido feito para um setor (equipe): fica no funil até o gestor passar para alguém */
  equipe?: string | null
  /** setores (equipes) avisados quando a entrega é aprovada/concluída */
  avisar?: string[]
  /** peça do Estúdio: aprovação só na aba Aprovar do Estúdio */
  estudio?: boolean
}

export type Channel = 'feed' | 'reels' | 'stories' | 'facebook' | 'site' | 'linkedin'

/** evento da agenda (não é tarefa) */
export interface CalEvent { id: string; title: string; day: string; time: string | null; created_by: string; created_at: string; dept?: string }

/** meta do mês: posts = posts publicados (tarefa com canal feita), tasks = tarefas feitas, manual = valor digitado */
export interface Goal {
  id: string; title: string; target: number; metric: 'posts' | 'tasks' | 'manual'; month: string
  reward: string; value: number; created_by: string; created_at: string
  /** progresso já existente na criação (não paga) */
  base?: number
  dept?: string
}

export type StickerKind = 'mandou-bem' | 'destaque' | 'pausa' | 'parabens' | 'top' | 'recorde'
/** adesivo que o gerente cola na tela de alguém (x/y = fração da tela) */
export interface Sticker { id: string; to_id: string; by_id: string; kind: StickerKind; text: string; x: number; y: number; created_at: string }

/** passo de um fluxo: vira tarefa ao enviar */
export interface FlowNode { id: string; title: string; owner: string | null; due: string | null; x: number; y: number; after: string[]; task_id: string | null }
export interface Flow { id: string; name: string; objective: string; nodes: FlowNode[]; created_by: string; created_at: string; dept?: string }

/** etapa do quadro (coluna). kind = como o sistema entende a etapa: aprovação, feito… */
export type StageKind = 'todo' | 'doing' | 'review' | 'done'
export interface Stage { id: string; label: string; kind: StageKind; pos: number; created_by: string; created_at: string; dept?: string; criteria?: string[] }

/** grupo do chat: canal 'g:<id>'; aberto = qualquer um entra, fechado = só quem foi convidado */
export interface Group { id: string; name: string; icon: string; open: boolean; members: string[]; created_by: string; created_at: string }
/** sala do andar: id = rooms.id do layout dela; floor/slot = posição no andar */
/** flag: ícone da bandeira na porta · canais: a sala publica (posts, canais, agenda de publicação)
 *  door_open: porta aberta (qualquer um entra pelo corredor); fechada só quem é da sala e a Chefe · curtains_open: cortina do vidro aberta (quem passa vê dentro) */
export interface Dept { id: string; name: string; color: string; floor: number; slot: number; door_open?: boolean; curtains_open?: boolean; flag?: string | null; canais?: boolean; vendas?: boolean; sala_gerente?: boolean; abas?: string[] | null; tipo?: string | null; created_at: string }
/** layout de cada sala (id = id da sala; 'escritorio' = layout antigo do Marketing); data = Sala do editor */
export interface Room { id: string; data: unknown; created_by: string; created_at: string }
/** carpinteiro: pode editar o escritório até `until` */
export interface Carpenter { id: string; until: string; created_by: string; created_at: string }
/** marca do cliente (linha única id 'marca'): logo = imagem em data URL, já reduzida no navegador */
export interface Brand { id: string; logo: string | null; created_at: string }
/** Comercial · tipo de quarto do quadro de disponibilidade (ativo=false = arquivado, as vendas antigas seguem) */
export interface Quarto { id: string; nome: string; total: number; pos: number; cor: string; ativo: boolean; created_by: string | null; created_at: string }
/** venda fechada: ocupa `qtd` quartos de entrada até a noite antes da saída (YYYY-MM-DD) */
export interface Venda { id: string; user_id: string; quarto_id: string; entrada: string; saida: string; qtd: number; valor: number; nota: string | null; created_by: string; created_at: string }
/** contagem manual do quadro num dia (id = quarto:dia); vendas lançadas depois descontam dela */
export interface Ajuste { id: string; quarto_id: string; dia: string; livres: number; created_by: string | null; created_at: string }
/** meta do mês em R$ (id = mes:user, ou mes:time com user_id nulo) */
export interface MetaVenda { id: string; user_id: string | null; mes: string; alvo: number; created_by: string | null; created_at: string }
export interface Tier { nome: string; min: number; cor: string }
export interface Premio { titulo: string; regra: 'pontos' | 'valor' | 'vendas'; alvo: number }
/** regras do placar (linha única 'cfg'): pontos por venda + por R$ 1.000, tiers por pontos do mês, prêmios do chefe */
export interface VendasCfg { id: 'cfg'; pts_venda: number; pts_mil: number; tiers: Tier[]; premios: Premio[]; pasta: DriveLink | null; created_at: string }
/** campanha do Marketing pro Comercial vender */
export interface Campanha { id: string; titulo: string; texto: string; inicio: string | null; fim: string | null; cor: string; pasta: DriveLink | null; link: string | null; created_by: string | null; created_at: string }
/** anotação do caderninho (só o dono vê; some em 7 dias se não for fixada) */
export interface Nota { id: string; user_id: string; texto: string; fixa: boolean; created_at: string }
/** recorde de uma pessoa num jogo da sala de jogos no mês (id = user:jogo:aaaa-mm) */
export interface JogoPonto { id: string; user_id: string; dept: string; jogo: string; mes: string; pontos: number; partidas: number; created_at: string; updated_at: string }
/** Plano macro: um ciclo de 12 meses (id do ciclo = 1º mês, YYYY-MM) */
export interface PlanoMes { id: string; ciclo: string; mes: string; tematica: string; principal: string; campanha: string; oferta: string; persona: string; estrategia: string; created_at: string; updated_at?: string }
/** núcleo = linha da matriz (stakeholder que executa); tipo datas = calendário comemorativo */
export interface PlanoNucleo { id: string; ciclo: string; nome: string; pos: number; tipo: 'acoes' | 'datas'; cor?: string | null; icone?: string | null; created_at: string }
export interface PlanoAcao { id: string; ciclo: string; nucleo: string; pos: number; mes: string; dia: string; resp: string; texto: string; estrategia: string; dept: string | null; pessoas: string[]; tarefas: string[]; data?: string | null; dono?: string | null; created_by: string | null; created_at: string; updated_at?: string }
/** sigla de responsável (MKT, PERF…) → sala e pessoas */
export interface PlanoResp { id: string; nome: string; dept: string | null; pessoas: string[]; equipes?: string[]; created_at: string }
/** equipe (Design, Edição de vídeo…): o gestor marca quem faz parte */
/** pedido ao gerente (aba Pedidos); histórico escrito só pelo servidor */
export type ReqTipo = 'material' | 'folga' | 'livre'
export type ReqStatus = 'aberto' | 'aprovado' | 'recusado' | 'entregue' | 'cancelado'
export interface ReqItem { id: string; nome: string; qtd: number; por?: string }
export interface Requisicao { id: string; dept: string; tipo: ReqTipo; titulo: string; detalhe: string; coletivo: boolean; itens: ReqItem[]; apoios: string[]; fecha: string | null; de: string | null; ate: string | null; status: ReqStatus; motivo: string; por: string; decidido_por: string | null; historico: { em: string; por: string; txt: string }[]; created_at: string; em: string }
export interface Equipe { id: string; nome: string; cor: string | null; icone: string | null; dept: string | null; pessoas: string[]; created_at: string }
/** último relatório da IA de cada pessoa (id = pessoa; ate exclusivo) */
export interface Relatorio { id: string; de: string; ate: string; semana: string; texto: string; resumo: string; em: string; feito_por?: string | null }
/** conta de rede social conectada (sem segredo; os tokens ficam só no servidor) */
export interface Rede { id: 'linkedin'; nome: string; autor: string; modo: 'pessoal' | 'empresa'; expira: string | null; refresh_expira: string | null; conectado_por: string | null; em: string }
/** fila de publicação: uma por tarefa (id = tarefa) */
export interface Postagem { id: string; rede: string; quando: string; estado: 'agendado' | 'publicando' | 'publicado' | 'erro'; urn: string | null; link: string | null; erro: string | null; tentativas: number; aprovado_por: string | null; em: string }
/** resposta das RPCs da sala de jogos; local = demo (a pontuação é gravada pelo app) */
export interface JogoRes { id?: string; pontos?: number; recorde?: boolean; valeu?: boolean; pos?: number; f?: number; outra?: number; par?: boolean; erros?: number; fim?: boolean; seg?: number; local?: boolean; desafio?: boolean }
/** um setor acompanha a Agenda/Plano/Publicações de outro (de = quem pediu, para = dono) */
export type ParModulo = 'agenda' | 'plano' | 'redes'
export interface Parceria { id: string; de: string; para: string; modulo: ParModulo; status: 'pendente' | 'aceito' | 'recusado'; por: string | null; decidido_por: string | null; created_at: string }
/** cartão/linha de um módulo do setor (reserva, obra, chamado, quarto, turno…); campos = valores livres do módulo */
export interface Registro { id: string; dept: string; modulo: string; titulo: string; status: string; campos: Record<string, unknown>; pos: number; por: string | null; created_at: string; em: string }
export type PoderTipo = 'ima' | 'coringa' | 'mesada' | 'megafone' | 'turbo' | 'chefe' | 'visao'
export interface Poder { id: string; user_id: string; tipo: PoderTipo; motivo: 'sorteio' | 'evento'; semana: string | null; inicio: string; fim: string; aviso: string | null; avisado_em: string | null; created_at: string }
export interface Rows { events: CalEvent; goals: Goal; stickers: Sticker; flows: Flow; stages: Stage; groups: Group; rooms: Room; carpenters: Carpenter; depts: Dept; brand: Brand; quartos: Quarto; vendas: Venda; ajustes: Ajuste; metas_venda: MetaVenda; vendas_cfg: VendasCfg; campanhas: Campanha; caderno: Nota; jogos_pontos: JogoPonto; plano_meses: PlanoMes; plano_nucleos: PlanoNucleo; plano_acoes: PlanoAcao; plano_resp: PlanoResp; equipes: Equipe; relatorios: Relatorio; redes: Rede; postagens: Postagem; requisicoes: Requisicao; parcerias: Parceria; registros: Registro; poderes: Poder }
export type RowTable = keyof Rows
export const ROW_TABLES: RowTable[] = ['events', 'goals', 'stickers', 'flows', 'stages', 'groups', 'rooms', 'carpenters', 'depts', 'brand', 'quartos', 'vendas', 'ajustes', 'metas_venda', 'vendas_cfg', 'campanhas', 'caderno', 'jogos_pontos', 'plano_meses', 'plano_nucleos', 'plano_acoes', 'plano_resp', 'equipes', 'relatorios', 'redes', 'postagens', 'requisicoes', 'parcerias', 'registros', 'poderes']

export type Priority = 'alta' | 'media' | 'baixa'
export interface CheckItem {
  id: string
  text: string
  done: boolean
}

export interface Attachment {
  id: string
  name: string
  /** caminho no storage (demo: chave local) */
  path: string
  type: string
  size: number
  by: string
  at: string
}

/** comentário no fio da tarefa */
export interface TaskNote {
  id: string
  task_id: string
  author_id: string
  body: string
  created_at: string
}

export interface Message {
  id: string
  channel: string
  sender_id: string
  body: string
  created_at: string
}

export interface Pos {
  x: number
  y: number
  dir: Dir
  moving: boolean
  /** onde a pessoa está: id da sala ou 'andar' (corredor) */
  room?: string
  /** andar (setor) em que a pessoa está andando */
  a?: string
  /** 1 = x/y no mapa do andar inteiro (versão nova); sem isso, era coordenada da sala */
  f?: 1
  /** ação a dois em andamento (colo, cavalinho...) com outra pessoa */
  acao?: { k: string; com: string; ate: number }
  /** quem foi carregado e desceu: ate da ação de que escapou */
  livre?: number
}

/** Proposta da IA do Gerente: ele revisa e só então distribui */
export interface AiItem {
  title: string
  owner_id: string
  due: string | null
  project_id: string | null
  notes: string
  /** por que essa pessoa */
  why: string
}
export interface AiProposal { summary: string; items: AiItem[] }
/** Vai junto do pedido: quem é o time e quanto cada um já tem aberto */
export interface AiContext {
  today: string
  me: { id: string; name: string; rank: number }
  people: { id: string; name: string; role: string; rank: number; open: number; late: number; online: boolean }[]
  projects: { id: string; name: string; master: string }[]
}
export type AiStage = 'pending' | 'working'

export interface Snapshot {
  profiles: Profile[]
  tasks: Task[]
  messages: Message[]
  notes: TaskNote[]
  projects: Project[]
  rows: { [K in RowTable]: Rows[K][] }
}

export interface AccountEdit { name: string; role: string; rank: number; is_admin: boolean; user: string }

export interface Handlers {
  profile(p: Profile): void
  profileDeleted(id: string): void
  task(t: Task): void
  taskDeleted(id: string): void
  message(m: Message): void
  note(n: TaskNote): void
  noteDeleted(id: string): void
  project(p: Project): void
  projectDeleted(id: string): void
  row<K extends RowTable>(table: K, r: Rows[K]): void
  rowDeleted(table: RowTable, id: string): void
  pos(id: string, p: Pos): void
  online(ids: string[]): void
}

export interface Backend {
  readonly mode: 'demo' | 'supabase'
  currentUserId(): Promise<string | null>
  /** sistema vazio: ninguém tem conta ainda, a primeira vira adm */
  needsSetup(): Promise<boolean>
  /** demo: cadastro livre. Servidor: só no primeiro acesso (cria o adm). null = precisa confirmar o e-mail */
  signUp(login: string, password: string, name: string, captcha?: string): Promise<string | null>
  /** login = usuário ou e-mail; captcha = prova do Turnstile (servidor com anti-robô ligado) */
  signIn(login: string, password: string, captcha?: string): Promise<string>
  signOut(): Promise<void>
  accountName(): Promise<string>
  loadAll(): Promise<Snapshot>
  /** devolve o perfil como ficou salvo (o cargo é decidido no servidor) */
  upsertProfile(p: Profile): Promise<Profile>
  setRank(target: string, rank: number): Promise<void>
  /** adm ou Chefe: muda de sala (as tarefas abertas vão junto) e senta na mesa `desk` */
  setDept(target: string, dept: string, desk: number): Promise<void>
  setDoor(dept: string, open: boolean): Promise<void>
  setCurtains(dept: string, open: boolean): Promise<void>
  setSalaGerente(dept: string, on: boolean): Promise<void>
  setDeptLook(dept: string, flag: string | null, canais: boolean, vendas?: boolean): Promise<void>
  setDeptAbas(dept: string, abas: string[] | null): Promise<void>
  setDeptTipo(dept: string, tipo: string | null): Promise<void>
  parceria(de: string, para: string, modulo: string, acao: 'pedir' | 'aceitar' | 'recusar' | 'sair'): Promise<Parceria | null>
  /** agenda do plano: dia/dono ajustados por quem é da equipe da ação */
  planoAgendar(id: string, data: string | null, dono: string | null): Promise<void>
  /** pedido ao gerente: editar | itens | apoio | status (regras no servidor) */
  requisicaoMudar(id: string, acao: 'editar' | 'itens' | 'apoio' | 'status', p: Record<string, unknown>): Promise<Requisicao | null>
  /** reserva o vínculo da tarefa (false = alguém já começou) */
  planoReservar(id: string, tarefa: string): Promise<boolean>
  planoSoltar(id: string, tarefa: string): Promise<void>
  /** só o adm: cria a conta já com perfil e cargo */
  createAccount(user: string, password: string, name: string, rank: number, dept?: string): Promise<Profile>
  /** só o adm */
  setPassword(target: string, password: string): Promise<void>
  /** só o adm: id → usuário de login */
  accountLogins(): Promise<Record<string, string>>
  /** só o adm: user vazio = mantém o login */
  updateAccount(target: string, a: AccountEdit): Promise<void>
  /** só o adm: tarefas e projetos vão para o herdeiro */
  deleteAccount(target: string, heir: string): Promise<void>
  uploadPhoto(userId: string, blob: Blob): Promise<string>
  upsertTask(t: Task): Promise<void>
  deleteTask(id: string): Promise<void>
  sendMessage(m: Message): Promise<void>
  /** devolve o caminho do arquivo guardado */
  uploadFile(taskId: string, file: File): Promise<string>
  /** link para abrir (ou baixar, com o nome dado) */
  fileUrl(path: string, download?: string): Promise<string>
  deleteFile(path: string): Promise<void>
  addNote(n: TaskNote): Promise<void>
  deleteNote(id: string): Promise<void>
  upsertProject(p: Project): Promise<void>
  deleteProject(id: string): Promise<void>
  /** agenda, metas, adesivos e fluxos */
  upsertRow<K extends RowTable>(table: K, r: Rows[K]): Promise<void>
  upsertRows<K extends RowTable>(table: K, rs: Rows[K][]): Promise<void>
  deleteRow(table: RowTable, id: string): Promise<void>
  /** entra (só em grupo aberto) ou sai de um grupo do chat */
  joinGroup(id: string, join: boolean): Promise<void>
  wallet(): Promise<Wallet>
  /** credita o cafezinho do dia e as metas batidas que faltam; devolve o que entrou agora */
  claimCoffee(): Promise<CoffeeLine[]>
  jogosDesafios(): Promise<CoffeeLine[]>
  buyItem(id: string): Promise<void>
  /** cassino: o servidor sorteia, guarda cartas/minas e paga */
  cassinoJogar(jogo: JogoCassino, aposta: number, e: Escolha): Promise<Rodada>
  cassinoAbrir(jogo: JogoCassino, aposta: number, e: Escolha): Promise<Rodada>
  cassinoAcao(id: string, acao: string, casa?: number): Promise<Rodada>
  cassinoEstado(jogo: JogoCassino): Promise<Rodada | null>
  /** conta do cassino: torneio aberto, histórico e (pra ela e o adm) os números da casa */
  cassinoPainel(): Promise<CassinoPainel>
  /** paga a mesada do dia da conta do cassino (0 se já pagou ou não é ela) */
  cassinoMesada(): Promise<number>
  torneioCriar(jogo: Torneio['jogo'], premio: number, horas: number): Promise<void>
  torneioCancelar(id: string): Promise<void>
  /** só a conta do cassino: imposto de 0 a 15%, muda 1x por dia */
  cassinoTaxa(taxa: number): Promise<void>
  /** só a conta do cassino: presente de 1 a 30 ☕ ou um item do Almoxarifado; 3 e 90 ☕ por dia */
  cassinoPresente(para: string, valor: number, item: string | null, rotulo: string, nota: string): Promise<void>
  /** só o adm: marca/desmarca a conta do cassino */
  setCassino(id: string, on: boolean): Promise<void>
  /** sala de jogos: a partida nasce no servidor, que confere o tempo e o teto (a Memória é jogada lá) */
  jogos(fn: 'iniciar' | 'fim' | 'virar', args: Record<string, unknown>): Promise<JogoRes>
  mesas(fn: MesaFn, pedido?: MesaPedido): Promise<MesaResposta>
  /** bolão: estado da semana (e sorteia a que fechou), compra de bilhete e troca de cafezinho por latinha */
  bolaoEstado(): Promise<Bolao>
  /** poderes: sorteia a semana (se faltar), paga mesada/coringa do dia e devolve os da última semana */
  poderesEstado(): Promise<Poder[]>
  megafone(texto: string): Promise<void>
  /** só com o poder Visão: quem tem mais bilhetes no bolão */
  visaoBolao(): Promise<{ u: string; n: number }[]>
  bolaoComprar(): Promise<Bolao>
  trocarLatinha(): Promise<number>
  /** bingo: rodada atual e próxima (o servidor confere e paga), compra de cartela pra próxima */
  bingoEstado(): Promise<Bingo>
  bingoComprar(gratis: boolean): Promise<Bingo>
  /** vigia dos jogos: null = liberado */
  jogosBloqueio(): Promise<Bloqueio | null>
  /** IA do Gerente: manda o pedido e espera a proposta (servidor: a ponte no PC roda o Claude) */
  askAI(prompt: string, ctx: AiContext, onStage: (s: AiStage) => void, signal: AbortSignal): Promise<AiProposal>
  /** a ponte do PC deu sinal de vida há pouco? */
  aiOnline(): Promise<boolean>
  connect(userId: string, h: Handlers): () => void
  sendPos(userId: string, p: Pos): void
  /** timelapse: minha trilha do dia (pontos [s, x, y, ...]) */
  saveTrail(userId: string, dia: string, pts: number[]): Promise<void>
  loadTrails(dia: string): Promise<{ user_id: string; pts: number[] }[]>
  /** apaga minhas trilhas antes de `antes` (guarda só 30 dias) */
  pruneTrails(userId: string, antes: string): Promise<void>
}
