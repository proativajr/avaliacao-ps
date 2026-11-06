// Teste no navegador do envio duplicado: clique duplo em "Salvar" (avaliador e candidato) e em "Adicionar" (colar lista).
// Sobe a API local com atraso e o site (vite) sozinho. Uso: node scripts/teste-clique-duplo.mjs [largura]
// Passa quando cada clique duplo gera UMA requisição, cria UM registro, o botão fica inativo com carregamento
// durante a requisição e um nome repetido mostra a mensagem de conflito dentro da janela.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';

const largura = Number(process.argv[2] || 1440);
const filhos = [];
const subir = (cmd, args, env, pronto) => new Promise((ok, falha) => {
  const p = spawn(cmd, args, { env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
  filhos.push(p);
  let saida = '';
  const ler = (b) => { saida += b; if (pronto.test(saida)) ok(saida); };
  p.stdout.on('data', ler); p.stderr.on('data', ler);
  p.on('exit', (c) => falha(new Error(cmd + ' saiu com ' + c + '\n' + saida)));
});
const encerrar = () => filhos.forEach((p) => p.kill());

let falhas = 0;
const conferir = (cond, msg) => { console.log((cond ? 'ok   ' : 'FALHA') + ' ' + msg); if (!cond) falhas++; };

try {
  const api = await subir('node', ['scripts/servidor-local.mjs', '8788'], { ATRASO_MS: '1200', N_AVAL: '3', N_CAND: '4' }, /Admin:/);
  const adm = api.match(/#adm=([^&\s]+)/)[1];
  await subir('node', ['node_modules/vite/bin/vite.js', '--port', '5180', '--strictPort'], {}, /Local:/);

  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: largura, height: 900 } });
  await p.route('**/config.js', (r) => r.fulfill({ contentType: 'text/javascript', body: "window.PS_CONFIG={api:{ensaio:'http://localhost:8788',producao:''}}" }));
  const envios = {};
  p.on('request', (r) => {
    const m = r.method() === 'POST' && (r.postData() || '').match(/"acao":"(admin\.\w+)"/);
    if (m) envios[m[1]] = (envios[m[1]] || 0) + 1;
  });
  const zerar = () => { for (const k of Object.keys(envios)) delete envios[k]; };
  const linhas = (txt) => p.locator('table.tabela tbody tr', { hasText: txt }).count();
  // Clica duas vezes e, durante a requisição, lê se o botão está inativo e com o anel de carregamento
  const cliqueDuplo = async (botao) => {
    await botao.dblclick();
    await p.waitForTimeout(200);
    const estado = await botao.evaluate((el) => ({ desabilitado: el.disabled, ocupado: el.getAttribute('aria-busy') === 'true', anel: !!el.querySelector('.giro-botao') })).catch(() => null);
    await p.waitForTimeout(2600);
    return estado;
  };

  await p.goto(`http://localhost:5180/#adm=${adm}&amb=ensaio`);
  await p.getByRole('button', { name: 'Pessoas' }).first().click();

  // 1. Avaliador: "Adicionar avaliador" + clique duplo em Salvar
  await p.getByRole('tab', { name: /Avaliadores/ }).click();
  await p.getByRole('button', { name: 'Adicionar avaliador' }).click();
  await p.locator('.modal input').first().fill('Duplo Clique');
  await p.locator('.modal select').selectOption('Projetos');
  zerar();
  let e = await cliqueDuplo(p.locator('.modal').getByRole('button', { name: 'Salvar' }));
  conferir(envios['admin.salvarAvaliadores'] === 1, `avaliador: 1 requisição (foram ${envios['admin.salvarAvaliadores'] || 0})`);
  conferir(e && e.desabilitado && e.ocupado && e.anel, 'avaliador: botão inativo e com carregamento durante a requisição');
  conferir(await linhas('Duplo Clique') === 1, 'avaliador: 1 registro criado');
  conferir(!(await p.locator('.modal').count()), 'avaliador: janela fechou no sucesso');

  // 2. Avaliador repetido: conflito do servidor aparece dentro da janela e o botão volta a funcionar
  await p.getByRole('button', { name: 'Adicionar avaliador' }).click();
  await p.locator('.modal input').first().fill('duplo clique');
  await p.locator('.modal select').selectOption('Comercial');
  await p.locator('.modal').getByRole('button', { name: 'Salvar' }).click();
  await p.waitForTimeout(2000);
  const msg = await p.locator('.modal .aviso.erro').innerText().catch(() => '');
  conferir(/Já existe um avaliador com este nome: Duplo Clique/.test(msg), `conflito: mensagem na janela ("${msg}")`);
  conferir(await p.locator('.modal').getByRole('button', { name: 'Salvar' }).isEnabled(), 'conflito: botão reativado');
  conferir(await linhas('Duplo Clique') === 1, 'conflito: nada criado');
  await p.locator('.modal').getByRole('button', { name: 'Cancelar' }).click();

  // 3. Colar lista + clique duplo em "Adicionar 2"
  await p.getByRole('button', { name: 'Colar lista' }).click();
  await p.locator('.modal textarea').fill('Lista Um, um@x.com, Projetos\nLista Dois, dois@x.com, Comercial');
  zerar();
  await cliqueDuplo(p.locator('.modal').getByRole('button', { name: /^Adicionar/ }));
  conferir(envios['admin.salvarAvaliadores'] === 1, `colar lista: 1 requisição (foram ${envios['admin.salvarAvaliadores'] || 0})`);
  conferir(await linhas('Lista Um') === 1 && await linhas('Lista Dois') === 1, 'colar lista: cada um criado uma vez');

  // 4. Candidato à mão + clique duplo em Salvar
  await p.getByRole('tab', { name: /Candidatos/ }).click();
  await p.getByRole('button', { name: 'Adicionar à mão' }).click();
  await p.locator('.modal input').first().fill('Candidato Duplo');
  await p.locator('.modal input[type=email]').fill('cand.duplo@x.com');
  zerar();
  e = await cliqueDuplo(p.locator('.modal').getByRole('button', { name: 'Salvar' }));
  conferir(envios['admin.salvarCandidatos'] === 1, `candidato: 1 requisição (foram ${envios['admin.salvarCandidatos'] || 0})`);
  conferir(e && e.desabilitado && e.ocupado, 'candidato: botão inativo e com carregamento durante a requisição');
  conferir(await linhas('Candidato Duplo') === 1, 'candidato: 1 registro criado');

  await b.close();
} catch (err) {
  console.error(err); falhas++;
} finally {
  encerrar();
}
console.log(falhas ? `\n${falhas} falha(s)` : '\nTudo certo');
process.exit(falhas ? 1 : 0);
