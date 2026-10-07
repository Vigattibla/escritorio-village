/** Contas são criadas pelo Chefe com um usuário; por baixo vira um e-mail interno que ninguém recebe. */
export const LOGIN_DOMAIN = 'escritorio.village'

/** "Maria Souza" → "maria.souza" */
export const slugUser = (u: string) =>
  u.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase().replace(/\s+/g, '.').replace(/[^a-z0-9._-]/g, '').slice(0, 30)

export const validUser = (u: string) => /^[a-z0-9._-]{2,30}$/.test(u)

/** O login aceita usuário ou e-mail (contas antigas). */
export const toEmail = (login: string) => (login.includes('@') ? login.trim().toLowerCase() : `${slugUser(login)}@${LOGIN_DOMAIN}`)

/** Senha fácil de ditar: sem 0/O, 1/l/I. */
export function makePassword(n = 8) {
  const abc = 'abcdefghijkmnpqrstuvwxyz23456789'
  return [...crypto.getRandomValues(new Uint32Array(n))].map(x => abc[x % abc.length]).join('')
}
