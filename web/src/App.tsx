import { useEffect, useState } from 'preact/hooks';
import { lerSessao, urlApi } from './api';
import { Toasts } from './ui';
import { Avaliador } from './avaliador/Avaliador';
import { Assinatura } from './marca';

/** O painel do admin só é baixado por quem é admin (o app do avaliador fica mais leve). */
function AdminPreguicoso(p: any) {
  const [C, setC] = useState<any>(null);
  useEffect(() => { import('./admin/Admin').then((m) => setC(() => m.Admin)); }, []);
  return C ? <C {...p} /> : <div class="carregando">Carregando o painel…</div>;
}

const { atual, outras } = lerSessao();

export function App() {
  if (!atual) {
    return (
      <div class="centro">
        <div class="cartao-simples">
          <Assinatura />
          <h1>Abra pelo seu link pessoal</h1>
          <p>Este app é usado pelos membros da Proativa Jr. para avaliar os candidatos do processo seletivo.</p>
          <p class="ajuda">Peça ao admin do PS o seu link (ele chega pelo WhatsApp). Depois de abrir uma vez, o app lembra de você neste aparelho.</p>
        </div>
      </div>
    );
  }
  if (!urlApi(atual.amb)) {
    return (
      <div class="centro">
        <div class="cartao-simples">
          <Assinatura />
          <h1>Falta configurar o app</h1>
          <p>O endereço do servidor do ambiente <b>{atual.amb === 'ensaio' ? 'de ensaio' : 'de produção'}</b> não foi preenchido no arquivo <code>config.js</code>.</p>
          <p class="ajuda">Quem publica o site: edite <code>web/public/config.js</code> e cole o URL do Web App do Apps Script.</p>
        </div>
      </div>
    );
  }
  return (
    <>
      {atual.perfil === 'admin' ? <AdminPreguicoso sessao={atual} outras={outras} /> : <Avaliador sessao={atual} outras={outras} />}
      <Toasts />
    </>
  );
}
