// Teste rápido da API publicada (não grava nada).
// Uso: node scripts/testar-api.mjs "https://script.google.com/macros/s/.../exec" "TOKEN_DO_ADMIN"
const [url, token] = process.argv.slice(2);
if (!url) { console.log('Uso: node scripts/testar-api.mjs URL_DO_WEB_APP [TOKEN_ADMIN]'); process.exit(1); }
async function chamar(acao, tk = token, dados = {}) {
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ acao, token: tk, dados }), redirect: 'follow' });
  return r.json();
}
const ping = await chamar('ping', '');
console.log('ping:', ping.ok ? `OK (versão ${ping.dados.versao}, modo ${ping.dados.modo})` : ping);
const falso = await chamar('av.iniciar', 'token-falso-0000000000000000000000');
console.log('token falso recusado:', falso.ok === false && falso.codigo === 'TOKEN_INVALIDO' ? 'OK' : falso);
if (token) {
  const t0 = Date.now();
  const adm = await chamar('admin.iniciar');
  console.log('admin.iniciar:', adm.ok ? `OK em ${Date.now() - t0} ms · ${adm.dados.candidatos.length} candidatos, ${adm.dados.avaliadores.length} avaliadores, ${adm.dados.avaliacoes.length} notas` : adm);
}
