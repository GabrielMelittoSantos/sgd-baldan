/* ==========================================================
   SGD • Dispositivos = cadastro de exemplo (SGD.devices) + laudos APROVADOS
   - "Última atualização" = data da aprovação mais recente de qualquer laudo.
   - Laudo de liberação aprovado de um código novo cadastra o dispositivo.
   Carregar DEPOIS de laudos.js e layout.js.
   ========================================================== */
(function () {
  'use strict';
  const N = (c) => Laudos.normCod(c);
  const fmt = (iso) => new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).replace(',', '');

  function enriquecer(d, ls) {
    // Todos os laudos do dispositivo
    const aprovados = ls.filter(l => l.status === 'aprovado');
  
    // Último laudo atualizado
    const ultimo = ls[0] || null;
  
    // Contagem considera somente laudos aprovados
    const cont = (tipo) =>
      aprovados.filter(l => l.tipo === tipo).length;
  
    // Status do dispositivo acompanha o laudo mais recente
    const status = ultimo ? ultimo.status : 'andamento';
  
    return {
      ...d,
      laudos: ls,
      lib: aprovados.find(l => l.tipo === 'liberacao') || null,
      ts: ultimo ? ultimo.atualizado : '',
      upd: aprovados.length
        ? fmt(aprovados.sort((a, b) =>
            b.decisao.em.localeCompare(a.decisao.em)
          )[0].decisao.em)
        : d.upd,
      status,
      cont: {
        liberacao: cont('liberacao'),
        corretiva: cont('corretiva'),
        preventiva: cont('preventiva')
      }
    };
  }

  function listar() {
    const conhecidos = new Set(
      SGD.devices.map(d => N(d.cod))
    );
  
    const base = SGD.devices.map(d =>
      enriquecer(d, Laudos.porCodigo(d.cod))
    );
  
    // Dispositivos novos continuam sendo cadastrados
    // somente após aprovação de um laudo de liberação.
    const novosCodigos = new Set(
      base.map(d => N(d.cod))
    );
  
    const novos = [];
  
    const todosAprovados = Laudos.aprovados();
  
    const por = {};
  
    todosAprovados.forEach(l => {
      const c = N(l.dados.codigo);
      if (c) (por[c] = por[c] || []).push(l);
    });
  
    Object.keys(por).forEach(c => {
      if (conhecidos.has(c) || novosCodigos.has(c)) return;
  
      const lib = por[c].find(l => l.tipo === 'liberacao');
  
      if (!lib) return;
  
      const x = lib.dados;
  
      novos.push(enriquecer({
        cod: c,
        desc: 'Dispositivo de ' + (x.tipo || '—'),
        produto: x.produto || '—',
        resp: x.resp_fab || lib.autorNome,
        tipo: x.tipo || 'Outros',
        upd: '',
        status: 'aprovado',
        prox: '—',
        novo: true
      }, Laudos.porCodigo(c)));
    });
  
    return [...novos, ...base].sort(
      (a, b) => b.ts.localeCompare(a.ts)
    );
  }

  window.Dispositivos = { listar, obter: (cod) => listar().find((d) => d.cod === N(cod)) || null, fmt };
})();
