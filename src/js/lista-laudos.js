/* SGD • Lista "Meus laudos" — <body data-tipo="liberacao|corretiva|preventiva"> */
(function () {
  'use strict';
  SGD.shell('dispositivos');
  const T = document.body.dataset.tipo, N = Laudos.LIMITE, $ = (s) => document.querySelector(s), q = $('#q'), tb = $('#rows');
  const fmt = (iso) => new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
  const PILL = { andamento: 'info', pendente: 'pend', reprovado: 'redo' };

  function stats() {
    const f = Laudos.fila(T).length, cheio = Laudos.vagas(T) <= 0;
    $('#sAnd').textContent = Laudos.contar(T, 'andamento');
    $('#sPend').textContent = Laudos.contar(T, 'pendente');
    $('#sRedo').textContent = Laudos.contar(T, 'reprovado');
    $('#sApr').textContent = Laudos.aprovadosMes(T);
    $('#sUso').textContent = Math.min(100, Math.round((f / N) * 100)) + '%';
    $('#sUsoTxt').textContent = 'Seu uso atual: ' + f + ' de ' + N + ' laudos';
    $('#n').textContent = Laudos.ativos(T).length;
    $('#novo').classList.toggle('is-disabled', cheio);
    $('#novo').setAttribute('aria-disabled', String(cheio));
    $('#aviso').hidden = !cheio;
    $('#aviso').textContent = Laudos.msgLimite(T);
  }

  function nota(x) {
    if (x.status === 'pendente') return 'Enviado em ' + fmt(x.enviado) + ' · aguardando resposta do gerente';
    if (x.status === 'reprovado') return 'Motivo: ' + ((x.decisao || {}).motivo || 'não informado');
    return '';
  }

  function draw() {
    const t = q.value.toLowerCase();
    const l = Laudos.ativos(T).filter((x) => JSON.stringify([x.dados.codigo, x.dados.produto, x.autorNome, Laudos.STATUS[x.status]]).toLowerCase().includes(t));
    tb.innerHTML = l.map((x) => {
      const d = SGD.devices.find((v) => v.cod === x.dados.codigo) || {};
      const abrir = x.status === 'reprovado' ? 'Refazer laudo' : Laudos.editavel(x) ? 'Abrir laudo' : 'Visualizar laudo';
      return `<tr class="row" data-id="${x.id}"><td><div class="dev"><span class="thumb"></span><div><b>${SGD.esc(x.dados.codigo || '—')}</b><small>${SGD.esc(d.desc || '')}</small></div></div></td>
        <td>${SGD.esc(x.dados.produto || d.produto || '—')}<small>Baldan</small></td><td>${SGD.esc(x.autorNome)}<small>Ferramentaria</small></td>
        <td>${fmt(x.atualizado)}</td>
        <td><span class="pill pill--${PILL[x.status]}">${Laudos.STATUS[x.status]}</span><small class="nota" title="${SGD.esc(nota(x))}">${SGD.esc(nota(x))}</small></td>
        <td><div class="row-actions"><a class="btn-icon" href="${T}-novo.html?id=${x.id}" aria-label="${abrir}" title="${abrir}">${SGD.ic('chev')}</a>${x.status === 'andamento' ? `<button type="button" class="btn-icon" data-del aria-label="Excluir laudo">${SGD.ic('trash')}</button>` : ''}</div></td></tr>`;
    }).join('') || '<tr><td colspan="6" class="empty">Nenhum laudo por aqui. Clique em “Novo laudo” para começar.</td></tr>';
  }

  tb.addEventListener('click', (e) => {
    const tr = e.target.closest('tr[data-id]'); if (!tr) return;
    if (e.target.closest('[data-del]')) {
      if (!confirm('Excluir este laudo em andamento? Essa ação não pode ser desfeita.')) return;
      try { Laudos.excluir(tr.dataset.id); stats(); draw(); SGD.toast('Laudo excluído'); } catch (err) { SGD.toast(err.message); }
    } else if (!e.target.closest('a')) location.href = T + '-novo.html?id=' + tr.dataset.id;
  });
  q.addEventListener('input', draw);
  stats(); draw();
})();
