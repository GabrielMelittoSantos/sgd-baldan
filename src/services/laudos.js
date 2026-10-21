/* ==========================================================
   SGD • Laudos (localStorage) + fluxo de aprovação
   Status:  andamento → pendente (enviado ao gerente)
            pendente  → aprovado  |  reprovado ("Refazer documento")
            reprovado → (usuário corrige e conclui) → pendente
   FILA (limite por usuário e por tipo) = andamento + reprovado.
   Laudos "pendente" estão com o gerente e não ocupam vaga.
   ========================================================== */
(function () {
  'use strict';
  const KEY = 'sgd:laudos';
  const LIMITE = 5; // ← altere aqui o limite da fila
  const TIPOS = { liberacao: 'liberação', corretiva: 'corretiva', preventiva: 'preventiva' };
  const STATUS = { andamento: 'Em andamento', pendente: 'Aguardando gerente', reprovado: 'Refazer documento', aprovado: 'Aprovado' };

  /* Compatibilidade com dados antigos: 'concluido' = pendente; 'preventivo' = 'preventiva' */
  const norm = (l) => ({ ...l, tipo: l.tipo === 'preventivo' ? 'preventiva' : l.tipo, status: l.status === 'concluido' ? 'pendente' : l.status, enviado: l.enviado || l.concluido || null, historico: l.historico || [] });
  const todos = () => { try { return (JSON.parse(localStorage.getItem(KEY)) || []).map(norm); } catch (_) { return []; } };
  const gravar = (l) => { try { localStorage.setItem(KEY, JSON.stringify(l)); } catch (_) { throw new Error('Não foi possível salvar (armazenamento cheio).'); } };
  const eu = () => (Auth.sessao() || {}).email;
  const ordem = { reprovado: 0, andamento: 1, pendente: 2 };

  const meus = (tipo) => todos().filter((l) => l.autor === eu() && (!tipo || l.tipo === tipo));
  const fila = (tipo) => meus(tipo).filter((l) => l.status === 'andamento' || l.status === 'reprovado');
  const ativos = (tipo) => meus(tipo).filter((l) => l.status !== 'aprovado').sort((a, b) => ordem[a.status] - ordem[b.status] || b.atualizado.localeCompare(a.atualizado));
  const contar = (tipo, st) => meus(tipo).filter((l) => l.status === st).length;
  const aprovadosMes = (tipo) => { const n = new Date(); return meus(tipo).filter((l) => { if (l.status !== 'aprovado' || !l.decisao) return false; const d = new Date(l.decisao.em); return d.getMonth() === n.getMonth() && d.getFullYear() === n.getFullYear(); }).length; };
  const vagas = (tipo) => LIMITE - fila(tipo).length;
  const obter = (id) => todos().find((l) => l.id === id) || null;
  const editavel = (l) => l.autor === eu() && (l.status === 'andamento' || l.status === 'reprovado');
  const normCod = (c) => String(c || '').trim().toUpperCase();
  /* Laudos aprovados pela gerência (de qualquer usuário), do mais recente ao mais antigo. Filtros: { cod, tipo } */
  const aprovados = (f = {}) => todos().filter((l) => l.status === 'aprovado' && l.decisao && (!f.tipo || l.tipo === f.tipo) && (!f.cod || normCod(l.dados.codigo) === normCod(f.cod)))
    .sort((a, b) => b.decisao.em.localeCompare(a.decisao.em));
  const fmt = (iso) => new Date(iso).toLocaleDateString('pt-BR');

  const msgLimite = (tipo) => 'Você já tem ' + LIMITE + ' laudos de ' + TIPOS[tipo] + ' em andamento ou para refazer. Conclua ou exclua um para abrir outro.';
  const msgLeitura = (l) => l.autor !== eu() ? 'Você está apenas visualizando este laudo.'
    : l.status === 'pendente' ? 'Laudo enviado: aguardando resposta do gerente. Somente leitura.' : 'Laudo aprovado. Somente leitura.';
  const msgReprovado = (l) => 'Reprovado por ' + ((l.decisao || {}).por || 'gerente') + ' em ' + fmt((l.decisao || {}).em || l.atualizado) + '. Motivo: ' + ((l.decisao || {}).motivo || 'não informado') + '. Corrija e conclua novamente.';

  /* l = { id?, tipo, status: 'andamento' | 'pendente', dados }  — 'pendente' = concluir e enviar ao gerente */
  function salvar(l) {
    const lista = todos(), s = Auth.sessao(), agora = new Date().toISOString();
    const envia = l.status === 'pendente';
    const i = l.id ? lista.findIndex((x) => x.id === l.id) : -1;

    if (i < 0) {
      if (!envia && vagas(l.tipo) <= 0) throw new Error(msgLimite(l.tipo));
      const novo = { id: 'L' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7), tipo: l.tipo, status: l.status, autor: s.email, autorNome: s.nome,
        dados: l.dados, criado: agora, atualizado: agora, enviado: envia ? agora : null, decisao: null, historico: envia ? [{ status: 'pendente', em: agora, por: s.nome }] : [] };
      lista.push(novo); gravar(lista); return novo;
    }
    const a = lista[i];
    if (!editavel(a)) throw new Error('Este laudo não pode ser editado.');
    lista[i] = { ...a, status: envia ? 'pendente' : a.status, dados: l.dados, atualizado: agora,
      enviado: envia ? agora : a.enviado, decisao: envia ? null : a.decisao,
      historico: envia ? [...a.historico, { status: 'pendente', em: agora, por: s.nome }] : a.historico };
    gravar(lista); return lista[i];
  }

  function excluir(id) {
    const l = obter(id);
    if (!l || l.autor !== eu() || l.status !== 'andamento') throw new Error('Só é possível excluir seus laudos em andamento.');
    gravar(todos().filter((x) => x.id !== id));
  }

  /* ---- Gestão (somente administrador) ---- */
  const exigeAdmin = () => { const s = Auth.sessao(); if (!s || !s.admin) throw new Error('Apenas a gestão pode aprovar ou reprovar.'); return s; };
  const todosGestao = () => { exigeAdmin(); return todos(); };

  function decidir(ids, aprovar, motivo) {
    const s = exigeAdmin();
    if (!aprovar && !String(motivo || '').trim()) throw new Error('Informe o motivo da reprovação.');
    const lista = todos(), agora = new Date().toISOString(); let n = 0;
    lista.forEach((l) => {
      if (!ids.includes(l.id) || l.status !== 'pendente') return;
      l.status = aprovar ? 'aprovado' : 'reprovado';
      l.decisao = { por: s.nome, em: agora, motivo: aprovar ? '' : String(motivo).trim() };
      l.atualizado = agora;
      l.historico.push({ status: l.status, em: agora, por: s.nome, motivo: l.decisao.motivo });
      n += 1;
    });
    gravar(lista); return n;
  }

  window.Laudos = { LIMITE, TIPOS, STATUS, fila, emAndamento: fila, ativos, contar, aprovadosMes, vagas, obter, editavel, salvar, excluir,
    aprovados, normCod, todosGestao, decidir, msgLimite, msgLeitura, msgReprovado };
})();
