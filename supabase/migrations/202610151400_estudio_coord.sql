-- Estúdio para a coordenação: o adm cria os moldes (chat, só adm); coordenação pra cima pede carrossel pelos moldes prontos.
drop policy if exists "estudio: pedir" on public.estudio_pedidos;
create policy "estudio: pedir" on public.estudio_pedidos for insert to authenticated
  with check (criado_por = auth.uid() and estado = 'fila' and (public.is_admin(auth.uid()) or public.rank_of(auth.uid()) >= 2));
