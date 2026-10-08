#!/usr/bin/env node
// Liga o Drive do Village ao escritório: abre o login do Google, pega a autorização e copia
// o "refresh token" pra área de transferência (não mostra na tela). Depois é só colar no Supabase
// (Edge Functions › Secrets › GOOGLE_REFRESH_TOKEN).
// node scripts/google-autorizar.mjs   (pede o Client ID e o Client secret do Google Cloud)
import { createServer } from 'node:http'
import { spawn } from 'node:child_process'
import { createInterface } from 'node:readline/promises'
import { randomBytes, createHash } from 'node:crypto'

const rl = createInterface({ input: process.stdin, output: process.stdout })
const id = (process.env.GOOGLE_CLIENT_ID || await rl.question('Client ID: ')).trim()
const secret = (process.env.GOOGLE_CLIENT_SECRET || await rl.question('Client secret: ')).trim()
rl.close()

const verifier = randomBytes(32).toString('base64url')
const state = randomBytes(16).toString('hex')
const srv = createServer()
await new Promise(r => srv.listen(0, '127.0.0.1', r))
const redirect = `http://127.0.0.1:${srv.address().port}`
const url = 'https://accounts.google.com/o/oauth2/v2/auth?' + new URLSearchParams({
  client_id: id, redirect_uri: redirect, response_type: 'code', state,
  scope: 'https://www.googleapis.com/auth/drive', access_type: 'offline', prompt: 'consent',
  code_challenge: createHash('sha256').update(verifier).digest('base64url'), code_challenge_method: 'S256',
})
console.log('\nAbrindo o navegador. Entre com a conta do VILLAGE (a dos 5 TB) e permita o acesso.')
console.log('Se não abrir, cole este endereço no navegador:\n' + url + '\n')
if (process.platform === 'win32') spawn('cmd', ['/c', 'start', '', url.replace(/&/g, '^&')], { stdio: 'ignore' })
else spawn(process.platform === 'darwin' ? 'open' : 'xdg-open', [url], { stdio: 'ignore' })

const code = await new Promise((ok, fail) => srv.on('request', (req, res) => {
  const q = new URL(req.url, redirect).searchParams
  if (!q.has('code') && !q.has('error')) return res.end()
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
  res.end(q.get('code') && q.get('state') === state ? '<h2>Pronto! Pode fechar esta aba e voltar pro terminal.</h2>' : '<h2>Não deu certo. Veja o terminal.</h2>')
  srv.close()
  q.get('code') && q.get('state') === state ? ok(q.get('code')) : fail(new Error(q.get('error') || 'resposta inválida'))
}))

const r = await fetch('https://oauth2.googleapis.com/token', {
  method: 'POST',
  body: new URLSearchParams({ code, client_id: id, client_secret: secret, redirect_uri: redirect, grant_type: 'authorization_code', code_verifier: verifier }),
})
const j = await r.json()
if (!r.ok || !j.refresh_token) { console.error('O Google recusou:', j.error_description || j.error || 'sem refresh token'); process.exit(1) }

const who = await (await fetch('https://www.googleapis.com/drive/v3/about?fields=user(emailAddress),storageQuota', { headers: { Authorization: 'Bearer ' + j.access_token } })).json()
const clip = spawn(process.platform === 'win32' ? 'clip' : process.platform === 'darwin' ? 'pbcopy' : 'xclip', process.platform === 'linux' ? ['-selection', 'clipboard'] : [])
clip.stdin.end(j.refresh_token)
await new Promise(r => clip.on('close', r))
const tb = n => (Number(n) / 1e12).toFixed(2).replace('.', ',') + ' TB'
console.log(`Conta: ${who.user?.emailAddress ?? '?'} · ${tb(who.storageQuota?.usage ?? 0)} usados de ${who.storageQuota?.limit ? tb(who.storageQuota.limit) : 'ilimitado'}`)
console.log('Refresh token COPIADO. Cole no Supabase como GOOGLE_REFRESH_TOKEN (Ctrl+V). Não mande pra ninguém.')
