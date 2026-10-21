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
    const cont = (t) => ls.filter((l) => l.tipo === t).length;
    return { ...d, laudos: ls, lib: ls.find((l) => l.tipo === 'liberacao') || null, ts: ls[0] ? ls[0].decisao.em : '',
      upd: ls[0] ? fmt(ls[0].decisao.em) : d.upd, cont: { liberacao: cont('liberacao'), corretiva: cont('corretiva'), preventiva: cont('preventiva') } };
  }

  function listar() {
    const por = {};
    Laudos.aprovados().forEach((l) => { const c = N(l.dados.codigo); if (c) (por[c] = por[c] || []).push(l); });
    const conhecidos = new Set(SGD.devices.map((d) => N(d.cod)));
    const base = SGD.devices.map((d) => enriquecer(d, por[N(d.cod)] || []));
    const novos = Object.keys(por).filter((c) => !conhecidos.has(c) && por[c].some((l) => l.tipo === 'liberacao')).map((c) => {
      const lib = por[c].find((l) => l.tipo === 'liberacao'), x = lib.dados;
      return enriquecer({ cod: c, desc: 'Dispositivo de ' + (x.tipo || '—'), produto: x.produto || '—', resp: x.resp_fab || lib.autorNome,
        tipo: x.tipo || 'Outros', upd: '', status: 'lib', prox: '—', novo: true }, por[c]);
    });
    return [...novos, ...base].sort((a, b) => b.ts.localeCompare(a.ts)); // atualizados recentemente primeiro
  }

  window.Dispositivos = { listar, obter: (cod) => listar().find((d) => d.cod === N(cod)) || null, fmt };
})();
