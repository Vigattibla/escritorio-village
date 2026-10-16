-- Armário de pastas: guarda as folhas que iam pro chão do lado da mesa. Preço próprio (mais caro que o lendário).
insert into public.shop_items (id, price) values
  ('arquivo:aco', 400),
  ('arquivo:madeira', 450)
on conflict (id) do update set price = excluded.price;
