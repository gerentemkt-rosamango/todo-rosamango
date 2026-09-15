const CAMPANHAS = ['Natal', 'Black Friday', 'Ano Novo', 'Geral'];
const TAG_CLASS = {
  'Natal': 'tag-natal',
  'Black Friday': 'tag-black-friday',
  'Ano Novo': 'tag-ano-novo',
  'Geral': 'tag-geral'
};
const ICONE_SECAO = {
  'Vitrinismo': '🪟',
  'Casa Rosamango': '🏠',
  'Shooting Natal': '📸',
  'VM das Lojas': '🏷️',
  'Embalagens': '🎁',
  'Porta-Recados e Combos': '🎀',
  'Rádio Rosamango': '🎵',
  'CRM': '📲',
  'Material de Vendas': '📦',
  'Festa de Confraternização': '🥂',
  'Franquias': '🤝'
};
const ICONE_PADRAO = '📌';
const CACHE_KEY = 'todo-rosamango:cache';

const boardEl = document.getElementById('board');
const estadoErroEl = document.getElementById('estado-erro');
const filtrosEl = document.getElementById('filtros');
const formSecaoEl = document.getElementById('nova-secao');
const campoTextoEl = document.getElementById('campo-texto');
const botaoAdicionarEl = document.getElementById('botao-adicionar');
const toastEl = document.getElementById('toast');
const syncDotEl = document.getElementById('sync-dot');
const syncLabelEl = document.getElementById('sync-label');
const overallFillEl = document.getElementById('overall-fill');
const overallLabelEl = document.getElementById('overall-label');
const overallPctEl = document.getElementById('overall-pct');

let tarefas = [];
let filtroAtual = 'todas';
const secoesRecolhidas = new Set();

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function mostrarToast(mensagem) {
  toastEl.textContent = mensagem;
  toastEl.classList.add('visivel');
  setTimeout(() => toastEl.classList.remove('visivel'), 2200);
}

function urlConfigurada() {
  return CONFIG && CONFIG.WEBAPP_URL && CONFIG.WEBAPP_URL.indexOf('COLE_AQUI') === -1;
}

function setSync(estado, detalhe) {
  syncDotEl.className = 'sync-dot' + (estado === 'loading' ? ' loading' : estado === 'off' ? ' off' : '');
  syncLabelEl.textContent = estado === 'loading' ? 'conectando…' : estado === 'off' ? 'sem sincronização' : 'sincronizado';
  const offline = estado === 'off';
  estadoErroEl.hidden = !offline;
  if (offline) {
    estadoErroEl.innerHTML = `<strong>${esc(detalhe || 'Sem conexão com o backend.')}</strong>`;
  }
}

async function chamarBackend(payload) {
  const resposta = await fetch(CONFIG.WEBAPP_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(payload)
  });
  const dados = await resposta.json();
  if (!dados.ok) throw new Error(dados.error || 'Erro desconhecido no backend.');
  return dados;
}

async function carregarTarefas(tentativa = 1) {
  if (!urlConfigurada()) {
    setSync('off', 'Backend não configurado ainda: edite src/config.js (ou rode scripts/deploy.ps1) com a URL do Web App do Apps Script.');
    return;
  }
  setSync('loading');
  try {
    const resposta = await fetch(CONFIG.WEBAPP_URL);
    const dados = await resposta.json();
    if (!dados.ok) throw new Error(dados.error || 'Erro ao carregar tarefas.');
    tarefas = dados.tasks || [];
    localStorage.setItem(CACHE_KEY, JSON.stringify(tarefas));
    setSync('on');
    renderizar();
  } catch (erro) {
    if (tentativa < 3) {
      setTimeout(() => carregarTarefas(tentativa + 1), 1000 * tentativa);
      return;
    }
    const cache = localStorage.getItem(CACHE_KEY);
    if (cache) {
      tarefas = JSON.parse(cache);
      renderizar();
    }
    setSync('off', 'Sem conexão com o backend — ' + erro.message + (cache ? ' (mostrando última lista salva).' : ''));
  }
}

function montarArvore() {
  const pais = tarefas.filter((t) => !t.parentId);
  const filhosPorPai = new Map();
  tarefas
    .filter((t) => t.parentId)
    .forEach((filho) => {
      if (!filhosPorPai.has(filho.parentId)) filhosPorPai.set(filho.parentId, []);
      filhosPorPai.get(filho.parentId).push(filho);
    });
  return pais
    .slice()
    .sort((a, b) => new Date(a.criadoEm) - new Date(b.criadoEm))
    .map((pai) => ({ pai, subtarefas: filhosPorPai.get(pai.id) || [] }));
}

function combinaFiltro(sub) {
  return filtroAtual === 'todas' || (sub.categoria || 'Geral') === filtroAtual;
}

function renderizar() {
  const arvore = montarArvore();
  boardEl.innerHTML = '';

  let totalGeral = 0;
  let concluidasGeral = 0;

  arvore.forEach(({ pai, subtarefas }) => {
    totalGeral += subtarefas.length;
    concluidasGeral += subtarefas.filter((s) => s.status === 'Concluído').length;
  });

  const pct = totalGeral ? Math.round((concluidasGeral / totalGeral) * 100) : 0;
  overallLabelEl.textContent = `${concluidasGeral} de ${totalGeral} itens concluídos`;
  overallPctEl.textContent = pct + '%';
  overallFillEl.style.width = pct + '%';

  if (arvore.length === 0) {
    boardEl.innerHTML = '<div class="empty-state">Nenhuma seção ainda — crie uma abaixo.</div>';
    return;
  }

  arvore.forEach(({ pai, subtarefas }) => {
    boardEl.appendChild(criarSecao(pai, subtarefas));
  });
}

function criarSecao(pai, subtarefas) {
  const secao = document.createElement('section');
  secao.className = 'section' + (secoesRecolhidas.has(pai.id) ? ' collapsed' : '');
  secao.dataset.id = pai.id;

  const concluidas = subtarefas.filter((s) => s.status === 'Concluído').length;
  const icone = ICONE_SECAO[pai.texto] || ICONE_PADRAO;

  const head = document.createElement('div');
  head.className = 'section-head';
  head.innerHTML = `
    <div class="section-icon">${icone}</div>
    <div class="section-titles"><h3 contenteditable="true" spellcheck="false">${esc(pai.texto)}</h3></div>
    <div class="section-count">${concluidas}/${subtarefas.length}</div>
    <button type="button" class="section-delete" title="Excluir seção" data-acao="excluir-secao">✕</button>
    <button type="button" class="section-toggle" data-acao="toggle" aria-label="Expandir/recolher">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>
    </button>
  `;
  const tituloEl = head.querySelector('h3');
  tituloEl.addEventListener('click', (evento) => evento.stopPropagation());
  tituloEl.addEventListener('focusout', () => {
    const novoTexto = tituloEl.textContent.trim();
    if (!novoTexto) {
      tituloEl.textContent = pai.texto;
      return;
    }
    if (novoTexto !== pai.texto) editarTexto(pai, novoTexto);
  });
  tituloEl.addEventListener('keydown', (evento) => {
    if (evento.key === 'Enter') {
      evento.preventDefault();
      tituloEl.blur();
    }
  });
  head.querySelector('[data-acao="toggle"]').addEventListener('click', () => {
    secao.classList.toggle('collapsed');
    if (secao.classList.contains('collapsed')) secoesRecolhidas.add(pai.id);
    else secoesRecolhidas.delete(pai.id);
  });
  head.querySelector('[data-acao="excluir-secao"]').addEventListener('click', (evento) => {
    evento.stopPropagation();
    excluirTarefa(pai);
  });
  head.addEventListener('click', (evento) => {
    if (evento.target.closest('button')) return;
    secao.classList.toggle('collapsed');
    if (secao.classList.contains('collapsed')) secoesRecolhidas.add(pai.id);
    else secoesRecolhidas.delete(pai.id);
  });

  const body = document.createElement('div');
  body.className = 'section-body';

  const visiveis = subtarefas.filter(combinaFiltro);
  if (visiveis.length === 0) {
    const vazio = document.createElement('div');
    vazio.className = 'empty-state';
    vazio.textContent = filtroAtual === 'todas' ? 'Nenhum item ainda — adicione abaixo.' : 'Nenhum item nessa campanha.';
    body.appendChild(vazio);
  } else {
    visiveis.forEach((sub) => body.appendChild(criarLinhaItem(sub)));
  }

  body.appendChild(criarFormItem(pai.id));

  secao.append(head, body);
  return secao;
}

function criarLinhaItem(item) {
  const linha = document.createElement('div');
  const categoria = CAMPANHAS.includes(item.categoria) ? item.categoria : 'Geral';
  const concluido = item.status === 'Concluído';
  linha.className = 'item-row' + (concluido ? ' checked' : '');
  linha.dataset.id = item.id;

  const check = document.createElement('input');
  check.type = 'checkbox';
  check.className = 'item-check';
  check.checked = concluido;
  check.addEventListener('change', () => {
    alterarStatus(item, check.checked ? 'Concluído' : 'Pendente');
  });

  const texto = document.createElement('div');
  texto.className = 'item-text';
  texto.contentEditable = 'true';
  texto.spellcheck = false;
  texto.textContent = item.texto;
  texto.addEventListener('focusout', () => {
    const novoTexto = texto.textContent.trim();
    if (!novoTexto) {
      texto.textContent = item.texto;
      return;
    }
    if (novoTexto !== item.texto) editarTexto(item, novoTexto);
  });
  texto.addEventListener('keydown', (evento) => {
    if (evento.key === 'Enter') {
      evento.preventDefault();
      texto.blur();
    }
  });

  const tag = document.createElement('button');
  tag.type = 'button';
  tag.className = 'item-tag ' + TAG_CLASS[categoria];
  tag.textContent = categoria;
  tag.addEventListener('click', () => {
    const proxima = CAMPANHAS[(CAMPANHAS.indexOf(categoria) + 1) % CAMPANHAS.length];
    alterarCategoria(item, proxima);
  });

  const excluir = document.createElement('button');
  excluir.type = 'button';
  excluir.className = 'item-delete';
  excluir.setAttribute('aria-label', 'Remover item');
  excluir.textContent = '×';
  excluir.addEventListener('click', () => excluirTarefa(item));

  linha.append(check, texto, tag, excluir);
  return linha;
}

function criarFormItem(parentId) {
  const form = document.createElement('form');
  form.className = 'add-item-form';

  const input = document.createElement('input');
  input.type = 'text';
  input.placeholder = 'Adicionar item…';
  input.maxLength = 300;

  const botao = document.createElement('button');
  botao.type = 'submit';
  botao.textContent = 'Adicionar';

  form.append(input, botao);
  form.addEventListener('submit', (evento) => {
    evento.preventDefault();
    const texto = input.value.trim();
    if (!texto) return;
    adicionarTarefa(texto, 'Geral', parentId);
    input.value = '';
    input.focus();
  });

  return form;
}

async function adicionarTarefa(texto, categoria, parentId) {
  try {
    const { task } = await chamarBackend({ action: 'create', texto, categoria, parentId: parentId || undefined });
    tarefas.push(task);
    renderizar();
  } catch (erro) {
    mostrarToast('Erro ao adicionar: ' + erro.message);
  }
}

async function alterarStatus(tarefa, novoStatus) {
  const anterior = tarefa.status;
  tarefa.status = novoStatus;
  renderizar();
  try {
    await chamarBackend({ action: 'update', id: tarefa.id, status: novoStatus });
  } catch (erro) {
    tarefa.status = anterior;
    renderizar();
    mostrarToast('Erro ao atualizar: ' + erro.message);
  }
}

async function alterarCategoria(tarefa, novaCategoria) {
  const anterior = tarefa.categoria;
  tarefa.categoria = novaCategoria;
  renderizar();
  try {
    await chamarBackend({ action: 'update', id: tarefa.id, categoria: novaCategoria });
  } catch (erro) {
    tarefa.categoria = anterior;
    renderizar();
    mostrarToast('Erro ao mudar categoria: ' + erro.message);
  }
}

async function editarTexto(tarefa, novoTexto) {
  const anterior = tarefa.texto;
  tarefa.texto = novoTexto;
  try {
    await chamarBackend({ action: 'update', id: tarefa.id, texto: novoTexto });
  } catch (erro) {
    tarefa.texto = anterior;
    renderizar();
    mostrarToast('Erro ao editar: ' + erro.message);
  }
}

async function excluirTarefa(tarefa) {
  const idsRemovidos = new Set([tarefa.id, ...tarefas.filter((t) => t.parentId === tarefa.id).map((t) => t.id)]);
  const removidas = tarefas.filter((t) => idsRemovidos.has(t.id));
  tarefas = tarefas.filter((t) => !idsRemovidos.has(t.id));
  renderizar();
  try {
    await chamarBackend({ action: 'delete', id: tarefa.id });
  } catch (erro) {
    tarefas.push(...removidas);
    renderizar();
    mostrarToast('Erro ao excluir: ' + erro.message);
  }
}

formSecaoEl.addEventListener('submit', (evento) => {
  evento.preventDefault();
  const texto = campoTextoEl.value.trim();
  if (!texto) return;
  adicionarTarefa(texto, 'Geral', null);
  campoTextoEl.value = '';
  campoTextoEl.focus();
});

filtrosEl.addEventListener('click', (evento) => {
  const chip = evento.target.closest('.filter-chip');
  if (!chip) return;
  filtroAtual = chip.dataset.filtro;
  [...filtrosEl.querySelectorAll('.filter-chip')].forEach((c) => c.dataset.active = String(c === chip));
  renderizar();
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('service-worker.js').catch(() => {});
  });
}

carregarTarefas();
