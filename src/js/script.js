
/* ==========================================================
   SGD • Tela de login — comportamento
   ========================================================== */

(function () {
  'use strict';

  const form        = document.getElementById('loginForm');
  const inputUser   = document.getElementById('usuario');
  const inputPass   = document.getElementById('senha');
  const toggleBtn   = document.getElementById('togglePassword');
  const rememberBox = document.getElementById('lembrar');
  const errorBox    = document.getElementById('formError');
  const submitBtn   = document.getElementById('btnEntrar');
  const submitText  = submitBtn.querySelector('.btn__text');

  const STORAGE_KEY = 'sgd:usuario';
  

  // Destinos das páginas
  const PAGINA_NORMAL = 'src/pages/inicio.html';
  const PAGINA_ADMIN = 'src/pages/gestao-adm.html';

  /* ---------- Mostrar / ocultar senha ---------- */
  toggleBtn.addEventListener('click', () => {
    const show = inputPass.type === 'password';
    inputPass.type = show ? 'text' : 'password';
    toggleBtn.setAttribute('aria-pressed', String(show));
    toggleBtn.setAttribute(
      'aria-label',
      show ? 'Ocultar senha' : 'Mostrar senha'
    );
    inputPass.focus();
  });

  /* ---------- Lembrar acesso ---------- */
  try {
    const saved = localStorage.getItem(STORAGE_KEY);

    if (saved) {
      inputUser.value = saved;
      rememberBox.checked = true;
      inputPass.focus();
    }
  } catch (_) {}

  /* ---------- Validação ---------- */
  function setInvalid(input, invalid) {
    input.closest('.field').classList.toggle('is-invalid', invalid);
    input.setAttribute('aria-invalid', String(invalid));
  }

  function showError(message) {
    errorBox.textContent = message;
    errorBox.hidden = !message;
  }

  [inputUser, inputPass].forEach((input) =>
    input.addEventListener('input', () => {
      setInvalid(input, false);
      showError('');
    })
  );

  function validate() {
    const user = inputUser.value.trim();
    const pass = inputPass.value;

    setInvalid(inputUser, !user);
    setInvalid(inputPass, !pass);

    if (!user) {
      showError('Informe seu usuário ou e-mail.');
      inputUser.focus();
      return false;
    }

    if (!pass) {
      showError('Informe sua senha.');
      inputPass.focus();
      return false;
    }

    return true;
  }

  /* ---------- Envio ---------- */
  function setLoading(loading) {
    submitBtn.disabled = loading;
    submitBtn.classList.toggle('is-loading', loading);
    submitText.textContent = loading ? 'Entrando...' : 'Entrar';
  }

  /* Autenticação */
  const autenticar = (usuario, senha) =>
    Auth.entrar(usuario, senha);

  /* ---------- Redirecionamento de sessão existente ---------- */
  const sessaoAtual = Auth.sessao();

  if (sessaoAtual) {
    const destino = sessaoAtual.admin
      ? PAGINA_ADMIN
      : PAGINA_NORMAL;

    window.location.replace(destino);
  }

  /* ---------- Login ---------- */
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    showError('');

    if (!validate()) return;

    const usuarioDigitado = inputUser.value.trim();
    setLoading(true);

    try {
      // Recebe a sessão retornada pelo auth.js
      const usuarioLogado = await autenticar(
        usuarioDigitado,
        inputPass.value
      );

      try {
        if (rememberBox.checked) {
          localStorage.setItem(STORAGE_KEY, usuarioDigitado);
        } else {
          localStorage.removeItem(STORAGE_KEY);
        }
      } catch (_) {}

      submitText.textContent = 'Acesso liberado';

      // Administrador vai para a gestão administrativa.
      // Os demais usuários continuam indo para a tela normal.
      const destino = usuarioLogado.admin
        ? PAGINA_ADMIN
        : PAGINA_NORMAL;

      window.location.replace(destino);

    } catch (err) {
      setInvalid(inputUser, true);
      setInvalid(inputPass, true);

      showError(
        err.message || 'Não foi possível entrar. Tente novamente.'
      );

      setLoading(false);
      inputPass.select();
    }
  });

  /* ---------- Esqueci minha senha ---------- */
  document.querySelector('.link').addEventListener('click', (event) => {
    event.preventDefault();

    showError(
      'Para redefinir sua senha, fale com o administrador do sistema.'
    );
  });
})();
