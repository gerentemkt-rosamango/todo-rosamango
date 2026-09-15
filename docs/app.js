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

function renderizar() {
  const filtradas = filtroAtual === 'todas' ? tarefas : tarefas.filter((t) => t.status === filtroAtual);

  listaEl.innerHTML = '';
  estadoVazioEl.hidden = filtradas.length > 0;

  filtradas
    .slice()
    .sort((a, b) => new Date(b.criadoEm) - new Date(a.criadoEm))
    .forEach((tarefa) => {
      listaEl.appendChild(criarItem(tarefa));
    });
}

function criarItem(tarefa) {
  const li = document.createElement('li');
  li.className = `tarefa status-${slugStatus(tarefa.status)} cat-${slugCategoria(tarefa.categoria)}`;

  const conteudo = document.createElement('div');
  conteudo.className = 'conteudo';

  const texto = document.createElement('div');
  texto.className = 'texto';
  texto.textContent = tarefa.texto;

  const meta = document.createElement('div');
  meta.className = 'meta';
  meta.innerHTML = `
    <span class="chip cat-${slugCategoria(tarefa.categoria)}">${tarefa.categoria}</span>
    <span class="chip">${tarefa.status}</span>
  `;

  conteudo.append(texto, meta);

  const acoes = document.createElement('div');
  acoes.className = 'acoes';

  const proximoStatus = STATUS_ORDEM[(STATUS_ORDEM.indexOf(tarefa.status) + 1) % STATUS_ORDEM.length];
  const botaoAvancar = document.createElement('button');
  botaoAvancar.textContent = `→ ${proximoStatus}`;
  botaoAvancar.addEventListener('click', () => alterarStatus(tarefa, proximoStatus));

  const botaoExcluir = document.createElement('button');
  botaoExcluir.textContent = 'Excluir';
  botaoExcluir.className = 'excluir';
  botaoExcluir.addEventListener('click', () => excluirTarefa(tarefa));

  acoes.append(botaoAvancar, botaoExcluir);
  li.append(conteudo, acoes);
  return li;
}

async function adicionarTarefa(texto, categoria) {
  botaoAdicionarEl.disabled = true;
  try {
    const { task } = await chamarBackend({ action: 'create', texto, categoria });
    tarefas.push(task);
    renderizar();
    mostrarToast('Tarefa adicionada.');
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
  const indice = tarefas.findIndex((t) => t.id === tarefa.id);
  const removida = tarefas.splice(indice, 1)[0];
  renderizar();
  try {
    await chamarBackend({ action: 'delete', id: tarefa.id });
    mostrarToast('Tarefa excluída.');
  } catch (erro) {
    tarefas.splice(indice, 0, removida);
    renderizar();
    mostrarToast('Erro ao excluir: ' + erro.message);
  }
}

formEl.addEventListener('submit', (evento) => {
  evento.preventDefault();
  const texto = campoTextoEl.value.trim();
  if (!texto) return;
  adicionarTarefa(texto, campoCategoriaEl.value);
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
