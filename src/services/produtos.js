/* ==========================================================
   SGD • Produtos (campo "Produto" dos laudos)
   - Produtos principais ficam fixos aqui em PADRAO.
   - Produtos extras são criados SOMENTE pela gestão (tela Aprovações)
     e ficam em localStorage ('sgd:produtos').
   - Todo <select data-produtos> da página é preenchido automaticamente.
   Carregar DEPOIS de auth.js e ANTES dos scripts que usam Produtos.
   ========================================================== */
(function () {
  'use strict';
  const KEY = 'sgd:produtos';
  const PADRAO = ['Plataforma Dianteira', 'Base de Corte'];

  const chave = (s) => String(s || '').trim().toLowerCase();
  const extras = () => {
    try {
      const l = JSON.parse(localStorage.getItem(KEY));
      return Array.isArray(l) ? l.filter((n) => typeof n === 'string' && n.trim()) : [];
    } catch (_) { return []; }
  };
  const gravar = (l) => {
    try { localStorage.setItem(KEY, JSON.stringify(l)); }
    catch (_) { throw new Error('Não foi possível salvar (armazenamento cheio).'); }
  };

  const listar = () => [
    ...PADRAO.map((nome) => ({ nome, padrao: true })),
    ...extras().map((nome) => ({ nome, padrao: false }))
  ];
  const existe = (nome) => listar().some((p) => chave(p.nome) === chave(nome));

  const exigeAdmin = () => {
    const s = Auth.sessao();
    if (!s || !s.admin) throw new Error('Apenas a gestão pode criar ou remover produtos.');
  };

  function adicionar(nome) {
    exigeAdmin();
    nome = String(nome || '').trim().replace(/\s+/g, ' ');
    if (!nome) throw new Error('Informe o nome do produto.');
    if (nome.length > 40) throw new Error('O nome do produto deve ter no máximo 40 caracteres.');
    if (existe(nome)) throw new Error('Já existe um produto com esse nome.');
    gravar([...extras(), nome]);
    return nome;
  }

  function remover(nome) {
    exigeAdmin();
    if (PADRAO.some((p) => chave(p) === chave(nome))) throw new Error('Os produtos principais não podem ser removidos.');
    gravar(extras().filter((x) => chave(x) !== chave(nome)));
  }

  // Preenche um <select> mantendo o primeiro <option> (placeholder)
  function preencher(sel) {
    const atual = sel.value;
    [...sel.querySelectorAll('option')].forEach((o, i) => { if (i > 0) o.remove(); });
    listar().forEach((p) => sel.append(new Option(p.nome, p.nome)));
    if (atual) sel.value = atual;
  }

  window.Produtos = { PADRAO, listar, adicionar, remover, preencher };
  document.querySelectorAll('select[data-produtos]').forEach(preencher);
})();
