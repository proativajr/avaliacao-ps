// Servidor LOCAL para testar o site sem o Google: roda o mesmo Codigo.gs num simulador.
// Uso: node scripts/servidor-local.mjs [porta]   (dados ficam só na memória)
// Imprime os links de admin e de avaliadores fictícios.
import http from 'node:http';
import { ambienteGoogle } from '../tests/lib/mock-google.mjs';

const porta = Number(process.argv[2] || 8787);
const { gas, props } = ambienteGoogle();
gas.setup();
if (process.env.FICTICIOS !== '0') gas.gerarDadosFicticios_(Number(process.env.N_CAND || 0) || 30, Number(process.env.N_AVAL || 0) || 12);
const site = process.env.SITE || 'http://localhost:5173/';

http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
  let corpo = '';
  req.on('data', (c) => (corpo += c));
  req.on('end', () => {
    const atraso = Number(process.env.ATRASO_MS || 150);
    setTimeout(() => {
      if (process.env.OFFLINE === '1') { res.writeHead(503); return res.end(); }
      const saida = req.method === 'POST' ? gas.doPost({ postData: { contents: corpo } }) : gas.doGet();
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(saida.getContent());
    }, atraso);
  });
}).listen(porta, () => {
  console.log(`API local em http://localhost:${porta}`);
  console.log(`Admin:     ${site}#adm=${props.get('ADMIN_TOKEN')}&amb=ensaio`);
  gas.lerObjetos_('Avaliadores').slice(0, 3).forEach((a) => console.log(`Avaliador: ${site}#t=${a.token}&amb=ensaio   (${a.nome})`));
});
