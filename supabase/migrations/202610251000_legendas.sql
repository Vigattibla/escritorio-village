-- Legendas com IA: guia de voz por marca, lido pela função legenda (Gemini).
-- Todo mundo logado lê; gerente (rank >= 3), Chefe ou adm editam o texto do guia.
create table if not exists public.marcas_voz (
  id text primary key,
  nome text not null,
  guia text not null default '',
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null
);
alter table public.marcas_voz enable row level security;

drop policy if exists "marcas_voz: ler" on public.marcas_voz;
create policy "marcas_voz: ler" on public.marcas_voz for select to authenticated using (true);
drop policy if exists "marcas_voz: editar" on public.marcas_voz;
create policy "marcas_voz: editar" on public.marcas_voz for update to authenticated
  using (public.is_admin(auth.uid()) or public.rank_of(auth.uid()) >= 3)
  with check (public.is_admin(auth.uid()) or public.rank_of(auth.uid()) >= 3);

insert into public.marcas_voz (id, nome, guia) values ('meudestino', 'MeuDestino', $guia$
MARCA: MeuDestino — clube de férias do Village Group. A pessoa assina e paga por mês diárias de hospedagem numa rede de hotéis e resorts, com data garantida e valor travado. Site: meudestino.com.

PARA QUEM: casais e famílias com filhos que viajam pelo menos uma vez por ano e querem parar de renegociar preço, data e vaga a cada temporada. Também quem já está hospedado num resort da rede.

PERSONALIDADE
- Clara: regra explicada antes de pedir a assinatura. Sem letra miúda.
- Segura: fala de garantia, prazo e valor fixo. Nunca de sorte ou oportunidade.
- Calorosa: a família e o descanso estão no centro, não o hotel.
- Direta: frases curtas, números concretos, "você".

VOZ: fala como quem já resolveu a viagem. Escreve para uma pessoa só, no "você". Troca adjetivo por número ("7 diárias por ano", não "muitas diárias"). Sem urgência falsa. Sem jargão de turismo.

EXEMPLOS
- Evite: "Aproveite essa oportunidade imperdível e garanta já o seu pacote promocional com descontos incríveis!"
  Prefira: "A viagem já está paga e o valor já está travado. Você só escolhe a data."
- Evite: "Invista em um título de multipropriedade e tenha acesso a uma rede exclusiva."
  Prefira: "Você não compra um imóvel nem um título. Compra diárias de hospedagem e paga por mês."
- Evite: "Condições especiais sujeitas a disponibilidade e regras do programa."
  Prefira: "Se a data ou o hotel tiver custo adicional, você sabe disso antes de confirmar. Nunca na chegada."

PALAVRAS DA MARCA: assinatura, clube, diárias, diárias garantidas, data garantida, valor travado, certeza, rede, sua família, antes de assinar.
PALAVRAS PROIBIDAS: imperdível, promoção, desconto, multipropriedade, cota, timeshare, últimas vagas, sujeito a, letra miúda.

ESCRITA DO NOME: MeuDestino (uma palavra, M e D maiúsculos). Endereço sempre meudestino.com, tudo minúsculo.

REDES SOCIAIS
- Abrir com uma frase que prende (cena de férias em família, um número, ou a dor de renegociar viagem todo ano).
- Emojis com moderação (0 a 3), nunca no lugar de palavras.
- CTA calmo e concreto: "Link na bio", "Chama no direct", "Conheça em meudestino.com". Nada de "corre", "só hoje".
- Hashtags: 3 a 6, em minúsculas, no fim. Sempre #meudestino; as outras ligadas ao destino ou ao tema (ex.: #feriasemfamilia #viagemfamilia #resort).
$guia$)
on conflict (id) do nothing;
