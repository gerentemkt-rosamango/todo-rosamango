const STATUS_ORDEM = ['Pendente', 'Em andamento', 'Concluído'];
const CACHE_KEY = 'todo-rosamango:cache';

const listaEl = document.getElementById('lista-tarefas');
const estadoVazioEl = document.getElementById('estado-vazio');
const estadoErroEl = document.getElementById('estado-erro');
const formEl = document.getElementById('nova-tarefa');
const campoTextoEl = document.getElementById('campo-texto');
const campoCategoriaEl = document.getElementById('campo-categoria');
const botaoAdicionarEl = document.getElementById('botao-adicionar');
const filtrosEl = document.getElementById('filtros');
const toastEl = document.getElementById('toast');

let tarefas = [];
let filtroAtual = 'todas';

function slugCategoria(categoria) {
  return (categoria || 'Geral')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, '-');
}

function slugStatus(status) {
  return slugCategoria(status);
}

function mostrarToast(mensagem) {
  toastEl.textContent = mensagem;
  toastEl.classList.add('visivel');
  setTimeout(() => toastEl.classList.remove('visivel'), 2200);
}

function urlConfigurada() {
  return CONFIG && CONFIG.WEBAPP_URL && CONFIG.WEBAPP_URL.indexOf('COLE_AQUI') === -1;
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

async function carregarTarefas() {
  if (!urlConfigurada()) {
    estadoErroEl.hidden = false;
    estadoErroEl.textContent =
      'Backend não configurado ainda: edite src/config.js (ou rode scripts/deploy.ps1) com a URL do Web App do Apps Script.';
    return;
  }
  try {
    const resposta = await fetch(CONFIG.WEBAPP_URL);
    const dados = await resposta.json();
    if (!dados.ok) throw new Error(dados.error || 'Erro ao carregar tarefas.');
    tarefas = dados.tasks || [];
    localStorage.setItem(CACHE_KEY, JSON.stringify(tarefas));
    estadoErroEl.hidden = true;
    renderizar();
  } catch (erro) {
    const cache = localStorage.getItem(CACHE_KEY);
    if (cache) {
      tarefas = JSON.parse(cache);
      renderizar();
      mostrarToast('Sem conexão — mostrando última lista salva.');
    } else {
      estadoErroEl.hidden = false;
      estadoErroEl.textContent = 'Não foi possível carregar as tarefas: ' + erro.message;
    }
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
  return pais.map((pai) => ({ pai, subtarefas: filhosPorPai.get(pai.id) || [] }));
}

function subtarefaCombinaFiltro(subtarefa) {
  return filtroAtual === 'todas' || subtarefa.status === filtroAtual;
}

function renderizar() {
  const arvore = montarArvore();
  listaEl.innerHTML = '';

  const visiveis = arvore.filter(({ pai, subtarefas }) => {
    if (filtroAtual === 'todas') return true;
    if (subtarefas.length === 0) return pai.status === filtroAtual;
    return subtarefas.some(subtarefaCombinaFiltro);
  });

  estadoVazioEl.hidden = visiveis.length > 0;

  visiveis
    .slice()
    .sort((a, b) => new Date(a.pai.criadoEm) - new Date(b.pai.criadoEm))
    .forEach(({ pai, subtarefas }) => {
      listaEl.appendChild(criarCardTarefa(pai, subtarefas));
    });
}

function criarCardTarefa(pai, subtarefas) {
  const li = document.createElement('li');
  li.className = 'tarefa-pai';

  const cabecalho = document.createElement('div');
  cabecalho.className = 'cabecalho-pai';

  const titulo = document.createElement('div');
  titulo.className = 'titulo-pai';
  titulo.textContent = pai.texto;

  const acoesPai = document.createElement('div');
  acoesPai.className = 'acoes-pai';

  if (subtarefas.length > 0) {
    const concluidas = subtarefas.filter((s) => s.status === 'Concluído').length;
    const progresso = document.createElement('span');
    progresso.className = 'chip progresso';
    progresso.textContent = `${concluidas}/${subtarefas.length} concluídas`;
    acoesPai.appendChild(progresso);
  }

  const botaoExcluirPai = document.createElement('button');
  botaoExcluirPai.textContent = 'Excluir seção';
  botaoExcluirPai.className = 'excluir';
  botaoExcluirPai.addEventListener('click', () => excluirTarefa(pai));
  acoesPai.appendChild(botaoExcluirPai);

  cabecalho.append(titulo, acoesPai);

  const listaSub = document.createElement('ul');
  listaSub.className = 'lista-subtarefas';
  subtarefas
    .filter(subtarefaCombinaFiltro)
    .forEach((sub) => listaSub.appendChild(criarLinhaSubtarefa(sub)));

  const formSub = criarFormSubtarefa(pai.id);

  li.append(cabecalho, listaSub, formSub);
  return li;
}

function criarLinhaSubtarefa(subtarefa) {
  const li = document.createElement('li');
  li.className = `subtarefa status-${slugStatus(subtarefa.status)} cat-${slugCategoria(subtarefa.categoria)}`;

  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.checked = subtarefa.status === 'Concluído';
  checkbox.addEventListener('change', () => {
    alterarStatus(subtarefa, checkbox.checked ? 'Concluído' : 'Pendente');
  });

  const texto = document.createElement('span');
  texto.className = 'texto-sub';
  texto.textContent = subtarefa.texto;

  const chipCategoria = document.createElement('span');
  chipCategoria.className = `chip cat-${slugCategoria(subtarefa.categoria)}`;
  chipCategoria.textContent = subtarefa.categoria;

  const botaoAndamento = document.createElement('button');
  botaoAndamento.className = 'andamento';
  botaoAndamento.textContent = subtarefa.status === 'Em andamento' ? '● em andamento' : 'marcar em andamento';
  botaoAndamento.addEventListener('click', () => {
    alterarStatus(subtarefa, subtarefa.status === 'Em andamento' ? 'Pendente' : 'Em andamento');
  });

  const botaoExcluir = document.createElement('button');
  botaoExcluir.textContent = '✕';
  botaoExcluir.className = 'excluir-sub';
  botaoExcluir.title = 'Excluir subtarefa';
  botaoExcluir.addEventListener('click', () => excluirTarefa(subtarefa));

  li.append(checkbox, texto, chipCategoria, botaoAndamento, botaoExcluir);
  return li;
}

function criarFormSubtarefa(parentId) {
  const form = document.createElement('form');
  form.className = 'nova-subtarefa';

  const input = document.createElement('input');
  input.type = 'text';
  input.placeholder = 'Nova subtarefa…';
  input.maxLength = 300;

  const select = document.createElement('select');
  ['Geral', 'Natal', 'Black Friday', 'Ano Novo'].forEach((cat) => {
    const opt = document.createElement('option');
    opt.value = cat;
    opt.textContent = cat;
    select.appendChild(opt);
  });

  const botao = document.createElement('button');
  botao.type = 'submit';
  botao.textContent = '+';

  form.append(input, select, botao);
  form.addEventListener('submit', (evento) => {
    evento.preventDefault();
    const texto = input.value.trim();
    if (!texto) return;
    adicionarTarefa(texto, select.value, parentId);
    input.value = '';
    input.focus();
  });

  return form;
}

async function adicionarTarefa(texto, categoria, parentId) {
  botaoAdicionarEl.disabled = true;
  try {
    const { task } = await chamarBackend({ action: 'create', texto, categoria, parentId: parentId || undefined });
    tarefas.push(task);
    renderizar();
    mostrarToast(parentId ? 'Subtarefa adicionada.' : 'Tarefa adicionada.');
  } catch (erro) {
    mostrarToast('Erro ao adicionar: ' + erro.message);
  } finally {
    botaoAdicionarEl.disabled = false;
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

async function excluirTarefa(tarefa) {
  const idsRemovidos = new Set([tarefa.id, ...tarefas.filter((t) => t.parentId === tarefa.id).map((t) => t.id)]);
  const removidas = tarefas.filter((t) => idsRemovidos.has(t.id));
  tarefas = tarefas.filter((t) => !idsRemovidos.has(t.id));
  renderizar();
  try {
    await chamarBackend({ action: 'delete', id: tarefa.id });
    mostrarToast('Excluído.');
  } catch (erro) {
    tarefas.push(...removidas);
    renderizar();
    mostrarToast('Erro ao excluir: ' + erro.message);
  }
}

formEl.addEventListener('submit', (evento) => {
  evento.preventDefault();
  const texto = campoTextoEl.value.trim();
  if (!texto) return;
  adicionarTarefa(texto, campoCategoriaEl.value, null);
  campoTextoEl.value = '';
  campoTextoEl.focus();
});

filtrosEl.addEventListener('click', (evento) => {
  const botao = evento.target.closest('button[data-filtro]');
  if (!botao) return;
  filtroAtual = botao.dataset.filtro;
  [...filtrosEl.querySelectorAll('button')].forEach((b) => b.classList.toggle('ativo', b === botao));
  renderizar();
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('service-worker.js').catch(() => {});
  });
}

carregarTarefas();
