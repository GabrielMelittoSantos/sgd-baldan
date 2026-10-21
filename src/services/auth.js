
/* ==========================================================
   SGD • Autenticação (localStorage)
   Sem tela de cadastro: só entram e-mails da lista abaixo.
   Para liberar/remover alguém, edite USUARIOS.
   Hash = SHA-256 da senha.
   ⚠ Autenticação 100% no navegador NÃO é segurança real.
   ========================================================== */
(function () {
  'use strict';

  const SENHA_DEMO = 'b72f28c5adf38ae0e200763790f3fcfc8568b796a16140c8fb03cec55baf7e71';

  const USUARIOS = [
    { email: 'vinicius.urbano@baldan.com.br', nome: 'Vinicius Urbano', setor: 'Ferramentaria Baldan', hash: SENHA_DEMO },
    { email: 'carlos.silva@baldan.com.br', nome: 'Carlos Silva', setor: 'Ferramentaria Baldan', hash: SENHA_DEMO },
    { email: 'rafael.costa@baldan.com.br', nome: 'Rafael Costa', setor: 'Ferramentaria Baldan', hash: SENHA_DEMO },

    // Administrador
    {
      email: 'baldan@gmail.com',
      nome: 'Administrador Baldan',
      setor: 'Administração',
      hash: SENHA_DEMO,
      admin: true
    }
  ];

  const K_SESSAO = 'sgd:sessao';
  const K_TENT = 'sgd:tentativas';
  const HORAS = 8;
  const MAX_TENT = 5;
  const BLOQUEIO_MS = 60000;
  const RAIZ = '../../index.html';

  const ler = (k) => {
    try {
      return JSON.parse(localStorage.getItem(k));
    } catch (_) {
      return null;
    }
  };

  const gravar = (k, v) => {
    try {
      localStorage.setItem(k, JSON.stringify(v));
    } catch (_) {}
  };

  const sha256 = async (s) =>
    [...new Uint8Array(
      await crypto.subtle.digest(
        'SHA-256',
        new TextEncoder().encode(s)
      )
    )]
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

  function sessao() {
    const s = ler(K_SESSAO);

    if (!s || s.expira < Date.now()) {
      try {
        localStorage.removeItem(K_SESSAO);
      } catch (_) {}

      return null;
    }

    return s;
  }

  async function entrar(identificador, senha) {
    if (!window.crypto || !crypto.subtle) {
      throw new Error('Abra o sistema por https ou localhost.');
    }

    const t = ler(K_TENT) || { n: 0, ate: 0 };

    if (t.ate > Date.now()) {
      throw new Error(
        'Muitas tentativas. Aguarde ' +
        Math.ceil((t.ate - Date.now()) / 1000) +
        's.'
      );
    }

    const id = identificador.trim().toLowerCase();

    const u = USUARIOS.find(
      (x) => x.email === id || x.email.split('@')[0] === id
    );

    if (!u || u.hash !== await sha256(senha)) {
      t.n += 1;

      if (t.n >= MAX_TENT) {
        t.n = 0;
        t.ate = Date.now() + BLOQUEIO_MS;
      }

      gravar(K_TENT, t);
      throw new Error('Usuário ou senha inválidos.');
    }

    try {
      localStorage.removeItem(K_TENT);
    } catch (_) {}

    const s = {
      email: u.email,
      nome: u.nome,
      setor: u.setor,
      admin: !!u.admin,
      expira: Date.now() + HORAS * 36e5
    };

    gravar(K_SESSAO, s);

    // Retorna a sessão para a tela de login decidir o destino.
    return s;
  }

  function sair() {
    try {
      localStorage.removeItem(K_SESSAO);
    } catch (_) {}

    location.href = RAIZ;
  }

  /* Use no topo de toda página interna */
  function exigir() {
    if (sessao()) return true;

    location.replace(RAIZ);
    return false;
  }

  window.Auth = {
    entrar,
    sair,
    sessao,
    exigir
  };
})();
