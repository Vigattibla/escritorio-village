/** Quem usa esta instância da Turmeo. O cliente troca só nome, logo e a cor de destaque; a estrutura é da Turmeo. */
export const TENANT = {
  name: 'Escritório Village',
  /** o que aparece ao lado da logo na barra lateral */
  short: 'Escritório',
  sub: 'Village Resort',
  /** logo padrão (fundo branco); adm ou Chefe troca pela barra lateral */
  logo: import.meta.env.BASE_URL + 'logo-cliente.svg',
  /** destaque: item ativo, botão principal, links */
  acc: '#26324F',
  /** segundo botão (Pedir algo) e logo */
  acc2: '#FFC600',
}
