/* SGD • Autenticação e solicitação de acesso.
   Protótipo front-end: os dados ficam no localStorage do navegador.
   Em produção, autenticação/aprovação devem ser validadas no servidor. */
(function () {
  'use strict';

  const SENHA_DEMO = 'b72f28c5adf38ae0e200763790f3fcfc8568b796a16140c8fb03cec55baf7e71';
  const USUARIOS_BASE = [
    { re: 'vinicius.urbano', email: 'vinicius.urbano@baldan.com.br', nome: 'Vinicius Urbano', setor: 'Ferramentaria Baldan', perfil: 'Projetista/Operacional', hash: SENHA_DEMO },
    { re: 'carlos.silva', email: 'carlos.silva@baldan.com.br', nome: 'Carlos Silva', setor: 'Ferramentaria Baldan', perfil: 'Projetista/Operacional', hash: SENHA_DEMO },
    { re: 'rafael.costa', email: 'rafael.costa@baldan.com.br', nome: 'Rafael Costa', setor: 'Ferramentaria Baldan', perfil: 'Projetista/Operacional', hash: SENHA_DEMO },
    { re: 'baldan', email: 'baldan@gmail.com', nome: 'Administrador Baldan', setor: 'Administração', perfil: 'Programador', hash: SENHA_DEMO, admin: true }
  ];

  const K_USUARIOS = 'sgd:usuarios';
  const K_SOLICITACOES = 'sgd:solicitacoes-acesso';
  const K_SESSAO = 'sgd:sessao';
  const K_TENT = 'sgd:tentativas';
  const HORAS = 8, MAX_TENT = 5, BLOQUEIO_MS = 60000;
  const RAIZ = '../../index.html';
  const PERFIS = ['Programador', 'Gerente (somente consulta)', 'Projetista/Operacional'];

  const ler = (k, fallback) => {
    try {
      const v = JSON.parse(localStorage.getItem(k));
      return v == null ? fallback : v;
    } catch (_) { return fallback; }
  };
  const gravar = (k, v) => localStorage.setItem(k, JSON.stringify(v));
  const usuarios = () => [...USUARIOS_BASE, ...ler(K_USUARIOS, [])];
  const solicitacoes = () => ler(K_SOLICITACOES, []);

  const sha256 = async (s) => [...new Uint8Array(await crypto.subtle.digest(
    'SHA-256', new TextEncoder().encode(s)
  ))].map((b) => b.toString(16).padStart(2, '0')).join('');

  function sessao() {
    const s = ler(K_SESSAO, null);
    if (!s || s.expira < Date.now()) {
      localStorage.removeItem(K_SESSAO);
      return null;
    }
    return s;
  }

  async function cadastrar({ nome, re, senha, perfil }) {
    if (!window.crypto || !crypto.subtle) throw new Error('Abra o sistema por https ou localhost.');
    nome = String(nome || '').trim();
    re = String(re || '').trim();
    senha = String(senha || '');
    if (!nome || !re || !senha || !perfil) throw new Error('Preencha todos os campos.');
    if (!/^[a-zA-Z0-9.-]{2,30}$/.test(re)) throw new Error('O RE deve ter de 2 a 30 caracteres (letras, números, ponto ou hífen).');
    if (senha.length < 8) throw new Error('A senha deve ter pelo menos 8 caracteres.');
    if (!PERFIS.includes(perfil)) throw new Error('Selecione um perfil válido.');
    const reNormalizado = re.toLowerCase();
    if (usuarios().some((u) => String(u.re || '').toLowerCase() === reNormalizado) ||
        solicitacoes().some((s) => s.re.toLowerCase() === reNormalizado && s.status === 'pendente')) {
      throw new Error('Já existe um usuário ou solicitação com esse RE.');
    }
    const lista = solicitacoes();
    lista.push({
      id: (crypto.randomUUID ? crypto.randomUUID() : String(Date.now())),
      nome, re, hash: await sha256(senha), perfilSolicitado: perfil,
      status: 'pendente', solicitadoEm: new Date().toISOString()
    });
    gravar(K_SOLICITACOES, lista);
    return true;
  }

  function listarSolicitacoes() {
    return solicitacoes().sort((a, b) => b.solicitadoEm.localeCompare(a.solicitadoEm));
  }

  function decidirSolicitacao(id, aprovar, perfilAutorizado) {
    const lista = solicitacoes();
    const item = lista.find((s) => s.id === id);
    if (!item || item.status !== 'pendente') throw new Error('Solicitação não encontrada ou já analisada.');
    if (aprovar) {
      const perfil = perfilAutorizado || item.perfilSolicitado;
      if (!PERFIS.includes(perfil)) throw new Error('Perfil autorizado inválido.');
      const ativos = ler(K_USUARIOS, []);
      ativos.push({
        re: item.re, nome: item.nome, setor: 'Ferramentaria Baldan',
        perfil, hash: item.hash, admin: false
      });
      gravar(K_USUARIOS, ativos);
      item.perfilAutorizado = perfil;
      item.status = 'aprovado';
    } else {
      item.status = 'recusado';
    }
    item.analisadoEm = new Date().toISOString();
    gravar(K_SOLICITACOES, lista);
    return item;
  }

  async function entrar(identificador, senha) {
    if (!window.crypto || !crypto.subtle) throw new Error('Abra o sistema por https ou localhost.');
    const t = ler(K_TENT, { n: 0, ate: 0 });
    if (t.ate > Date.now()) throw new Error('Muitas tentativas. Aguarde ' + Math.ceil((t.ate - Date.now()) / 1000) + 's.');
    const id = identificador.trim().toLowerCase();
    const u = usuarios().find((x) =>
      String(x.re || '').toLowerCase() === id ||
      String(x.email || '').toLowerCase() === id ||
      String(x.email || '').split('@')[0].toLowerCase() === id
    );
    if (!u || u.hash !== await sha256(senha)) {
      t.n += 1;
      if (t.n >= MAX_TENT) { t.n = 0; t.ate = Date.now() + BLOQUEIO_MS; }
      gravar(K_TENT, t);
      const pendente = solicitacoes().some((s) => s.re.toLowerCase() === id && s.status === 'pendente');
      if (pendente) throw new Error('Sua solicitação ainda aguarda aprovação da Gestão.');
      throw new Error('RE ou senha inválidos.');
    }
    localStorage.removeItem(K_TENT);
    const s = {
      re: u.re || u.email.split('@')[0], email: u.email || '',
      nome: u.nome, setor: u.setor, perfil: u.perfil || (u.admin ? 'Programador' : 'Projetista/Operacional'),
      admin: !!u.admin, expira: Date.now() + HORAS * 36e5
    };
    gravar(K_SESSAO, s);
    return s;
  }

  function sair() { localStorage.removeItem(K_SESSAO); location.href = RAIZ; }
  function exigir() { if (sessao()) return true; location.replace(RAIZ); return false; }

  window.Auth = { entrar, sair, sessao, exigir, cadastrar, listarSolicitacoes, decidirSolicitacao, PERFIS };
})();