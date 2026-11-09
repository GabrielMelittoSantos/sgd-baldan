/* ==========================================================
   SGD • Tipos de dispositivo (cor por tipo)
   - Tipos principais ficam fixos aqui em PADRAO.
   - Tipos extras são criados SOMENTE pela gestão (tela Aprovações)
     e ficam em localStorage ('sgd:tipos').
   - Todo <select data-tipos> da página é preenchido automaticamente.
   Carregar DEPOIS de auth.js e ANTES dos scripts que usam Tipos.
   ========================================================== */
(function () {
  'use strict';
  const KEY = 'sgd:tipos';
  const NEUTRA = '#5b6b82'; // tipo desconhecido / sem tipo

  const PADRAO = [
    { nome: 'Solda',             cor: '#7b4fd0' },
    { nome: 'Montagem',          cor: '#1f6fe0' },
    { nome: 'Matriz',            cor: '#c2410c' },
    { nome: 'Aferição',          cor: '#0f9d58' },
    { nome: 'Ferramenta de dobra', cor: '#be185d' },
    { nome: 'Furadeira',         cor: '#12a3a8' },
    { nome: 'Usinagem',          cor: '#d98a1c' },
    { nome: 'Placa de moldagem', cor: '#4d7c0f' }
  ];

  // Sugestões de cor para novos tipos (a gestão pode trocar no seletor)
  const SUGESTOES = ['#e11d48', '#0ea5e9', '#a16207', '#9333ea', '#14b8a6', '#f97316', '#6366f1', '#84cc16'];

  const chave = (s) => String(s || '').trim().toLowerCase();
  const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const HEX = /^#[0-9a-f]{6}$/i;

  const extras = () => {
    try {
      const l = JSON.parse(localStorage.getItem(KEY));
      return Array.isArray(l) ? l.filter((t) => t && t.nome && HEX.test(t.cor)) : [];
    } catch (_) { return []; }
  };
  const gravar = (l) => {
    try { localStorage.setItem(KEY, JSON.stringify(l)); }
    catch (_) { throw new Error('Não foi possível salvar (armazenamento cheio).'); }
  };

  const listar = () => [
    ...PADRAO.map((t) => ({ ...t, padrao: true })),
    ...extras().map((t) => ({ nome: t.nome, cor: t.cor, padrao: false }))
  ];
  const obter = (nome) => listar().find((t) => chave(t.nome) === chave(nome)) || null;
  const cor = (nome) => (obter(nome) || {}).cor || NEUTRA;

  // Texto escuro sobre cores claras, branco sobre cores escuras
  const textoSobre = (hex) => {
    const n = parseInt(hex.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    return (0.299 * r + 0.587 * g + 0.114 * b) > 160 ? '#10151c' : '#ffffff';
  };

  const pill = (nome) => {
    const c = cor(nome), t = (obter(nome) || {}).nome || nome || '—';
    return `<span class="pill" style="--pill:${c};color:${textoSobre(c)}">${esc(t)}</span>`;
  };

  const exigeAdmin = () => {
    const s = Auth.sessao();
    if (!s || !s.admin) throw new Error('Apenas a gestão pode criar ou remover tipos.');
  };

  function adicionar(nome, corHex) {
    exigeAdmin();
    nome = String(nome || '').trim().replace(/\s+/g, ' ');
    corHex = String(corHex || '').toLowerCase();
    if (!nome) throw new Error('Informe o nome do tipo.');
    if (nome.length > 30) throw new Error('O nome do tipo deve ter no máximo 30 caracteres.');
    if (!HEX.test(corHex)) throw new Error('Escolha uma cor válida.');
    if (obter(nome)) throw new Error('Já existe um tipo com esse nome.');
    if (listar().some((t) => t.cor.toLowerCase() === corHex)) throw new Error('Essa cor já é usada por outro tipo. Escolha uma cor diferente.');
    gravar([...extras(), { nome, cor: corHex }]);
    return obter(nome);
  }

  function remover(nome) {
    exigeAdmin();
    const t = obter(nome);
    if (!t) return;
    if (t.padrao) throw new Error('Os tipos principais não podem ser removidos.');
    gravar(extras().filter((x) => chave(x.nome) !== chave(nome)));
  }

  const sugerirCor = () => {
    const usadas = listar().map((t) => t.cor.toLowerCase());
    return SUGESTOES.find((c) => !usadas.includes(c)) || '#ffffff';
  };

  // Preenche um <select> mantendo o primeiro <option> (placeholder)
  function preencher(sel) {
    const atual = sel.value;
    [...sel.querySelectorAll('option')].forEach((o, i) => { if (i > 0) o.remove(); });
    listar().forEach((t) => sel.append(new Option(t.nome, t.nome)));
    if (atual) sel.value = atual;
  }

  window.Tipos = { PADRAO, listar, obter, cor, pill, adicionar, remover, sugerirCor, preencher, textoSobre, NEUTRA };
  document.querySelectorAll('select[data-tipos]').forEach(preencher);
})();
