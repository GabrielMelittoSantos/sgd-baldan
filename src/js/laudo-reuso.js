/* ==========================================================
   SGD • Reaproveitamento de dados entre laudos do mesmo dispositivo
   Seções compartilhadas: desenho técnico, medidas e checklist.

   Ao informar o código do dispositivo em um NOVO laudo (liberação,
   corretiva ou preventiva), procura laudos já existentes com o mesmo
   código e preenche as seções automaticamente.

   - Prefere laudos APROVADOS; depois os mais recentes. Laudos
     reprovados (em correção) nunca são usados como fonte.
   - Cada seção escolhe a sua melhor fonte (o desenho pode vir da
     liberação e o checklist da preventiva, por exemplo).
   - Valores MEDIDOS e resultados do checklist não são copiados por
     padrão: cada laudo é uma nova inspeção. Mude COPIAR_RESULTADOS
     para true se quiser copiá-los também.
   - Se o operador já mexeu nas seções, pergunta antes de substituir.

   Carregar DEPOIS de laudos.js e layout.js.
   ========================================================== */
(function () {
  'use strict';

  const COPIAR_RESULTADOS = false;
  const MAX_LADO = 1800;              // px — maior lado do desenho depois de reduzido
  const QUALIDADE = 0.82;             // JPEG
  const MAX_PDF = 1.2 * 1024 * 1024;  // bytes (o armazenamento do navegador é limitado)
  const ROTULO = { liberacao: 'liberação', corretiva: 'corretiva', preventiva: 'preventiva' };
  const NOME_SECAO = { desenho: 'desenho técnico', medidas: 'medidas', checklist: 'checklist' };

  /* O que conta como "seção preenchida" em um laudo salvo (null = vazia) */
  const SECOES = {
    desenho: (d) => (d.desenho && d.desenho.src ? d.desenho : null),
    medidas: (d) => { const l = (d.medidas || []).filter((m) => m.desc || m.espec || m.metodo); return l.length ? l : null; },
    checklist: (d) => { const l = (d.checklist || []).filter((c) => c.desc); return l.length ? l : null; }
  };

  const esc = (v) => (window.SGD ? SGD.esc(v) : String(v == null ? '' : v));
  const fmtData = (iso) => new Date(iso).toLocaleDateString('pt-BR');

  /* ---------- Desenho: leitura, compressão e pré-visualização ---------- */
  const lerArquivo = (file) => new Promise((ok, err) => {
    const r = new FileReader();
    r.onload = () => ok(r.result);
    r.onerror = () => err(new Error('Não foi possível ler o arquivo.'));
    r.readAsDataURL(file);
  });

  async function prepararDesenho(file) {
    if (file.type === 'application/pdf') {
      if (file.size > MAX_PDF) throw new Error('PDF muito grande (máx. 1,2 MB). Reduza o arquivo ou envie o desenho como imagem.');
      return { nome: file.name, tipo: file.type, src: await lerArquivo(file) };
    }
    if (!file.type.startsWith('image/')) throw new Error('Envie uma imagem ou um PDF.');
    const src = await lerArquivo(file);
    const img = await new Promise((ok, err) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = () => err(new Error('Imagem inválida.'));
      i.src = src;
    });
    const k = Math.min(1, MAX_LADO / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement('canvas');
    c.width = Math.round(img.naturalWidth * k);
    c.height = Math.round(img.naturalHeight * k);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#fff'; // PNG transparente vira fundo branco no JPEG
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(img, 0, 0, c.width, c.height);
    return { nome: file.name, tipo: 'image/jpeg', src: c.toDataURL('image/jpeg', QUALIDADE) };
  }

  const blobUrl = (src) => {
    const [h, b] = src.split(',');
    const mime = (h.match(/:(.*?);/) || [])[1] || 'application/pdf';
    const bin = atob(b), u = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    return URL.createObjectURL(new Blob([u], { type: mime }));
  };

  function mostrar(prev, d, vazio) {
    if (!d || !d.src) { prev.textContent = vazio; return; }
    if (d.tipo === 'application/pdf') {
      const a = document.createElement('a');
      a.href = blobUrl(d.src); a.target = '_blank'; a.rel = 'noopener';
      a.textContent = d.nome + ' (PDF) — abrir';
      prev.replaceChildren(a);
    } else {
      const img = new Image();
      img.alt = 'Desenho técnico'; img.src = d.src;
      prev.replaceChildren(img);
    }
  }

  /* ---------- Escolha das fontes ---------- */
  const ordenar = (a, b) => (b.status === 'aprovado') - (a.status === 'aprovado') || b.atualizado.localeCompare(a.atualizado);

  function procurarFontes(cod, idAtual) {
    const lista = Laudos.porCodigo(cod).filter((l) => l.id !== idAtual && l.status !== 'reprovado').sort(ordenar);
    const achados = {};
    Object.keys(SECOES).forEach((k) => {
      const l = lista.find((x) => SECOES[k](x.dados || {}));
      if (l) achados[k] = { laudo: l, valor: SECOES[k](l.dados) };
    });
    return { lista, achados };
  }

  const lista = (a) => (a.length > 1 ? a.slice(0, -1).join(', ') + ' e ' + a[a.length - 1] : a[0]);

  function textoOrigem(achados) {
    const grupos = new Map();
    Object.entries(achados).forEach(([k, { laudo }]) => {
      if (!grupos.has(laudo.id)) grupos.set(laudo.id, { laudo, secoes: [] });
      grupos.get(laudo.id).secoes.push(NOME_SECAO[k]);
    });
    return [...grupos.values()].map(({ laudo, secoes }) => {
      const quando = fmtData((laudo.decisao && laudo.decisao.em) || laudo.atualizado);
      return lista(secoes) + ' do laudo de ' + ROTULO[laudo.tipo] + ' (' + Laudos.STATUS[laudo.status].toLowerCase() + ', ' + quando + ')';
    }).join('; ');
  }

  /* ---------- API ---------- */
  function iniciar(o) {
    const { f, M, C, mrow, crow, prev, file } = o;
    const cod = o.cod || f.querySelector('#cod');
    const vazio = prev.textContent.trim();
    let desenho = null, sujo = false, ultimoCod = null, snap = null, aplicado = false;

    /* O operador mexeu nas seções? (então não substituímos sem perguntar) */
    f.addEventListener('input', (e) => { if (e.target.closest('#medidas, #check')) sujo = true; });
    f.addEventListener('click', (e) => { if (e.target.closest('[data-del], #addM, #addC')) sujo = true; });

    file.addEventListener('change', async () => {
      const x = file.files[0];
      if (!x) return;
      try {
        desenho = await prepararDesenho(x);
        sujo = true;
        mostrar(prev, desenho, vazio);
      } catch (err) {
        SGD.toast(err.message, 4500);
      }
      file.value = '';
    });

    const avisoEl = () => f.querySelector('#reuso-aviso');
    function avisar(msg) {
      let b = avisoEl();
      if (!msg) { if (b) b.remove(); return; }
      if (!b) { b = document.createElement('div'); b.id = 'reuso-aviso'; b.className = 'banner'; b.setAttribute('role', 'status'); f.prepend(b); }
      b.textContent = msg;
    }

    function aplicar(achados, lista) {
      if (!snap) snap = { M: M.innerHTML, C: C.innerHTML, desenho };
      if (achados.desenho) { desenho = { ...achados.desenho.valor }; mostrar(prev, desenho, vazio); }
      if (achados.medidas) {
        M.innerHTML = '';
        achados.medidas.valor.forEach((m) => mrow(COPIAR_RESULTADOS ? m : { desc: m.desc, espec: m.espec, metodo: m.metodo }));
      }
      if (achados.checklist) {
        C.innerHTML = '';
        achados.checklist.valor.forEach((c) => crow(COPIAR_RESULTADOS ? c : { desc: c.desc }));
      }
      // Produto e tipo também pertencem ao dispositivo: só preenche se estiver vazio
      ['produto', 'tipo'].forEach((n) => {
        const el = f.elements[n];
        const fonte = lista.find((l) => l.dados && l.dados[n]);
        if (el && !el.value && fonte) el.value = fonte.dados[n];
      });
      sujo = false; aplicado = true;
      avisar('Dados reaproveitados deste dispositivo: ' + textoOrigem(achados) + '.'
        + (COPIAR_RESULTADOS ? '' : ' As medições e os resultados do checklist não foram copiados — preencha-os nesta inspeção.')
        + ' Revise antes de salvar.');
    }

    function desfazer() {
      if (snap) { M.innerHTML = snap.M; C.innerHTML = snap.C; desenho = snap.desenho; mostrar(prev, desenho, vazio); }
      snap = null; aplicado = false; sujo = false; avisar('');
    }

    /* Procura laudos do mesmo código e preenche as seções (só em laudo novo e editável) */
    function sugerir() {
      if (o.atual() || cod.disabled) return;
      const c = Laudos.normCod(cod.value);
      if (!c || c === ultimoCod) return;
      ultimoCod = c;

      const { lista, achados } = procurarFontes(c, null);
      if (!Object.keys(achados).length) {
        if (aplicado && !sujo) desfazer();
        else if (aplicado) SGD.toast('Este código não tem laudos anteriores. Os dados já preenchidos foram mantidos — revise.', 4500);
        return;
      }
      if (sujo && !confirm('Já existem dados preenchidos nas seções de desenho, medidas ou checklist.\n\nSubstituir pelos dados já registrados para este dispositivo (' + textoOrigem(achados) + ')?')) return;
      aplicar(achados, lista);
    }

    cod.addEventListener('change', sugerir);

    return {
      sugerir,
      desenho: () => desenho,
      restaurar: (d) => { desenho = d && d.src ? d : null; mostrar(prev, desenho, vazio); }
    };
  }

  window.LaudoReuso = { iniciar, COPIAR_RESULTADOS };
})();
