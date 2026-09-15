/**
 * Backend do TODO List Rosamango — Google Apps Script Web App.
 * Planilha vinculada funciona como banco de dados; deploy via scripts/deploy.ps1 (clasp).
 * Publicado com access "ANYONE_ANONYMOUS" (ver appsscript.json) para editar sem login.
 *
 * Modelo: uma linha por tarefa. ParentID vazio = tarefa de topo (ex: "Vitrinismo");
 * ParentID preenchido = subtarefa daquele ID (ex: um item dentro de "Vitrinismo").
 * Um único nível de subtarefas (subtarefa não tem subtarefa).
 */

var SHEET_NAME = 'Tarefas';
var HEADERS = ['ID', 'ParentID', 'Texto', 'Categoria', 'Status', 'CriadoEm', 'AtualizadoEm'];
var STATUS_VALUES = ['Pendente', 'Em andamento', 'Concluído'];
var CATEGORY_COLORS = {
  'Natal': '#F6D9D9',
  'Black Friday': '#D9D9D9',
  'Ano Novo': '#D6E4F0',
  'Geral': '#E8E8E8'
};

function doGet(e) {
  var sheet = getSheet_();
  return jsonResponse_({ ok: true, tasks: readTasks_(sheet) });
}

function doPost(e) {
  var sheet = getSheet_();
  var payload = {};
  try {
    payload = JSON.parse(e.postData.contents);
  } catch (err) {
    return jsonResponse_({ ok: false, error: 'JSON inválido: ' + err.message });
  }

  var action = payload.action;
  try {
    if (action === 'create') return jsonResponse_({ ok: true, task: createTask_(sheet, payload) });
    if (action === 'update') return jsonResponse_({ ok: true, task: updateTask_(sheet, payload) });
    if (action === 'delete') return jsonResponse_({ ok: true, deleted: deleteTask_(sheet, payload) });
    if (action === 'seed') return jsonResponse_({ ok: true, seeded: seedPlanejamento_(sheet) });
    return jsonResponse_({ ok: false, error: 'Ação desconhecida: ' + action });
  } catch (err) {
    return jsonResponse_({ ok: false, error: err.message });
  }
}

function readTasks_(sheet) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  var rows = sheet.getRange(2, 1, lastRow - 1, HEADERS.length).getValues();
  var tasks = [];
  for (var i = 0; i < rows.length; i++) {
    var row = rows[i];
    if (!row[0]) continue;
    tasks.push(rowToTask_(row));
  }
  return tasks;
}

function rowToTask_(row) {
  return {
    id: row[0],
    parentId: row[1] || null,
    texto: row[2],
    categoria: row[3] || 'Geral',
    status: row[4] || STATUS_VALUES[0],
    criadoEm: row[5],
    atualizadoEm: row[6]
  };
}

function createTask_(sheet, payload) {
  var texto = (payload.texto || '').toString().trim();
  if (!texto) throw new Error('Texto da tarefa é obrigatório.');
  var parentId = payload.parentId || '';
  var categoria = payload.categoria || 'Geral';
  var now = new Date();
  var id = Utilities.getUuid();
  sheet.appendRow([id, parentId, texto, categoria, STATUS_VALUES[0], now, now]);
  applyRowFormatting_(sheet, sheet.getLastRow());
  return rowToTask_([id, parentId, texto, categoria, STATUS_VALUES[0], now, now]);
}

function updateTask_(sheet, payload) {
  var rowIndex = findRowById_(sheet, payload.id);
  if (rowIndex === -1) throw new Error('Tarefa não encontrada: ' + payload.id);

  var range = sheet.getRange(rowIndex, 1, 1, HEADERS.length);
  var row = range.getValues()[0];

  if (typeof payload.texto === 'string' && payload.texto.trim()) row[2] = payload.texto.trim();
  if (typeof payload.categoria === 'string' && payload.categoria) row[3] = payload.categoria;
  if (typeof payload.status === 'string') {
    if (STATUS_VALUES.indexOf(payload.status) === -1) throw new Error('Status inválido: ' + payload.status);
    row[4] = payload.status;
  }
  row[6] = new Date();

  range.setValues([row]);
  applyRowFormatting_(sheet, rowIndex);
  return rowToTask_(row);
}

/** Remove a tarefa; se for uma tarefa de topo, remove também as subtarefas dela. */
function deleteTask_(sheet, payload) {
  var rowIndex = findRowById_(sheet, payload.id);
  if (rowIndex === -1) return false;

  var idsParaRemover = [payload.id];
  var lastRow = sheet.getLastRow();
  if (lastRow >= 2) {
    var dados = sheet.getRange(2, 1, lastRow - 1, 2).getValues();
    for (var i = 0; i < dados.length; i++) {
      if (dados[i][1] === payload.id) idsParaRemover.push(dados[i][0]);
    }
  }

  idsParaRemover.forEach(function (id) {
    var linha = findRowById_(sheet, id);
    if (linha > 1) sheet.deleteRow(linha);
  });
  return true;
}

function findRowById_(sheet, id) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return -1;
  var ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) {
    if (ids[i][0] === id) return i + 2;
  }
  return -1;
}

/** Pega a aba "Tarefas"; cria e formata com a identidade visual Rosamango na primeira chamada. */
function getSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (sheet) return sheet;

  sheet = ss.insertSheet(SHEET_NAME);
  var defaultSheet = ss.getSheetByName('Sheet1') || ss.getSheetByName('Página1');
  if (defaultSheet && ss.getSheets().length > 1) ss.deleteSheet(defaultSheet);

  sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
  var header = sheet.getRange(1, 1, 1, HEADERS.length);
  header.setBackground('#000000').setFontColor('#FFFFFF').setFontWeight('bold');
  sheet.setFrozenRows(1);
  sheet.setColumnWidth(1, 40);
  sheet.setColumnWidth(2, 40);
  sheet.setColumnWidth(3, 360);
  sheet.setColumnWidth(4, 120);
  sheet.setColumnWidth(5, 130);
  sheet.setColumnWidth(6, 140);
  sheet.setColumnWidth(7, 140);
  sheet.hideColumns(1, 2);

  var statusRange = sheet.getRange(2, 5, 998, 1);
  var rule = SpreadsheetApp.newDataValidation().requireValueInList(STATUS_VALUES, true).setAllowInvalid(false).build();
  statusRange.setDataValidation(rule);

  applyStatusConditionalFormatting_(sheet);
  return sheet;
}

function applyStatusConditionalFormatting_(sheet) {
  var range = sheet.getRange(2, 5, 998, 1);
  var rules = sheet.getConditionalFormatRules().filter(function (r) {
    return r.getRanges().every(function (rg) { return rg.getColumn() !== 5; });
  });
  rules.push(
    SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo('Concluído')
      .setBackground('#D4EFDF')
      .setRanges([range])
      .build()
  );
  rules.push(
    SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo('Em andamento')
      .setBackground('#FCF3CF')
      .setRanges([range])
      .build()
  );
  sheet.setConditionalFormatRules(rules);
}

/** Colore a célula de Categoria da linha conforme a paleta Rosamango. */
function applyRowFormatting_(sheet, rowIndex) {
  var categoriaCell = sheet.getRange(rowIndex, 4);
  var categoria = categoriaCell.getValue();
  var color = CATEGORY_COLORS[categoria] || CATEGORY_COLORS['Geral'];
  categoriaCell.setBackground(color);
}

/**
 * Importa o planejamento de fim de ano (11 seções, 82 itens) como tarefas de topo
 * com subtarefas — só roda se a planilha ainda estiver vazia (idempotente).
 */
function seedPlanejamento_(sheet) {
  if (sheet.getLastRow() >= 2) return false;

  var secoes = [
    { secao: 'Vitrinismo', itens: [
      ['Arte do caminhão no mesmo contexto das vitrines das lojas', 'Natal'],
      ['Box Melhores Desejos no vitrinismo — entregue no kit necessaire + rasteiras (2025: 420 unidades disponíveis)', 'Natal'],
      ['Vitrine com rasteiras a partir de R$79,90, bolsas a partir de R$189,90, carteiras R$69,90 e saltos a partir de R$169,90 (confirmar)', 'Natal'],
      ['Criar caixa de correios, 1 por loja (Iguatemi em tamanho real)', 'Natal'],
      ['Contratar modelo para passear no shopping aos sábados (2025: 14 e 21/12 — ajustar datas 2026)', 'Natal'],
      ['Embalagem comemorativa de Natal tamanho M (mesmo corte da Rosamango) — 1.400 unidades, uso a partir de R$249,90', 'Natal'],
      ['Brinde: avaliar enfeite de Natal como opção, preço a definir', 'Natal'],
      ['Reels com o caminhão fazendo entrega', 'Natal']
    ]},
    { secao: 'Casa Rosamango', itens: [
      ['Árvore de Natal instalada (2025: 13/10 — ajustar data 2026)', 'Natal'],
      ['Fachada — criar ponto de luz de Natal', 'Natal'],
      ['Lâmpadas estáticas amarelas (branca quente) tradicionais — opção mais barata do mercado', 'Natal'],
      ['Estender horário dos sábados até 17h a partir de outubro', 'Geral'],
      ['Domingo antes do Natal funcionar no mesmo horário do sábado', 'Natal'],
      ['Vídeo institucional 3D', 'Geral'],
      ['Evento de Natal com embaixadoras da marca, clientes diamante e diretoria', 'Natal'],
      ['Comprar farda para copeira', 'Geral'],
      ['Happy Hour na Casa Rosamango às sextas de dezembro (gin tônica + música)', 'Natal'],
      ['Happy Hour na loja Jóquei (bebidas e salgados)', 'Natal'],
      ['Cheirinho de frutas vermelhas no ambiente', 'Geral'],
      ['Fazer eventos (1 comercial ou 1 mais intimista)', 'Geral'],
      ['Marcar dia de customização (ex: tênis)', 'Geral'],
      ['Evento de divulgação de coleção (ex: Twelly Cherry)', 'Geral']
    ]},
    { secao: 'Shooting Natal', itens: [
      ['Marcar shooting para a primeira semana de novembro (data a definir)', 'Natal'],
      ['Dois momentos: estúdio + locação (2025: casa da Dona Ana)', 'Natal']
    ]},
    { secao: 'VM das Lojas', itens: [
      ['1ª parte (ISCAS) — ROSA', 'Natal'],
      ['Rasteiras a partir de R$79,90', 'Natal'],
      ['Carteira em couro a partir de R$69,90', 'Natal'],
      ['Saltos a partir de R$169,90', 'Natal'],
      ['Bolsas a partir de R$189,90', 'Natal'],
      ['1ª parte (ISCAS) — OUTLET', 'Natal'],
      ['Coleção nova com 15%', 'Natal'],
      ['Promoção até 70% OFF', 'Black Friday'],
      ['Comunicação Amigo Secreto — BLU (revisar valores)', 'Natal'],
      ['Carteiras em couro R$59,90', 'Natal'],
      ['Cintos em couro R$99,90', 'Natal'],
      ['Kit cintos + carteira R$199,90 (preço combo)', 'Natal'],
      ['2ª parte — Pink Week / Black Friday (70% de desconto)', 'Black Friday'],
      ['Expor coleção passada com 70% (temporada anterior)', 'Black Friday'],
      ['50% na classe Promoção (produtos BF)', 'Black Friday'],
      ['Levantar produtos de baixo giro para entrar com 50%', 'Black Friday'],
      ['Blumango 50% (criar lista)', 'Black Friday'],
      ['Testeiras com 50% e 70%, três de cada', 'Black Friday'],
      ['Testeira Blu 30%', 'Black Friday'],
      ['Vitrine final — comunicação Boas-Festas', 'Natal'],
      ['Reservar espaço no meio da arte da vitrine para o adesivo de Black Friday', 'Black Friday'],
      ['1º embarque programado para chegar antes da Black Friday', 'Black Friday']
    ]},
    { secao: 'Embalagens', itens: [
      ['Usar embalagem Melhores Desejos para rasteira/kit', 'Natal'],
      ['Criar embalagem comemorativa de Natal tamanho M (mesmo corte da Rosamango) — 1.400 unidades, uso a partir de R$249,90', 'Natal']
    ]},
    { secao: 'Porta-Recados e Combos', itens: [
      ['Porta-recados com selos a partir de R$79,90 (3 por loja) e R$109,90 (3 por loja)', 'Natal'],
      ['Painel das rasteiras a partir de R$79,90 (5 por loja)', 'Natal'],
      ['Combos de Natal em duas formatações (porta-recado tamanho A5)', 'Natal'],
      ['Compre R$259,90 e ganhe um soldadinho (enfeite de árvore de Natal)', 'Natal'],
      ['Compre R$499,90 e ganhe uma maleta ou copo', 'Natal'],
      ['Compre R$250,00 + R$15,00 e leve a maleta ou copo', 'Natal'],
      ['Kit Blumango (carteira + cinto) R$199,90 (confirmar)', 'Natal'],
      ['Carteira em couro Blumango a partir de R$89,90 (confirmar)', 'Natal'],
      ['Cinto em couro a partir de R$109,90 (confirmar)', 'Natal'],
      ['Reforçar em todo material: promoções não cumulativas', 'Geral']
    ]},
    { secao: 'Rádio Rosamango', itens: [
      ['Programação com músicas natalinas (nacional e internacional)', 'Natal'],
      ['Período: novembro a dezembro (ajustar datas 2026)', 'Geral']
    ]},
    { secao: 'CRM', itens: [
      ['Campanha de agenda para cada combo', 'Natal'],
      ['Campanha de agenda para Blumango', 'Natal'],
      ['Campanha de agenda para Twelly', 'Natal'],
      ['Campanha de agenda para os eventos', 'Geral'],
      ['Campanha de agenda das Petites', 'Geral']
    ]},
    { secao: 'Material de Vendas', itens: [
      ['Sacolas de plástico (2025: 30.000 — ajustar)', 'Geral'],
      ['Sacolas de papel femininas/masculinas — sandálias e bolsas (revisar quantidades)', 'Geral'],
      ['Óculos/cintos/nécessaires (2025: 4.000 fem + 1.000 masc)', 'Geral'],
      ['Sacola Anna Macedo: 2.000', 'Geral'],
      ['TNT Anna Macedo: 2.000 (verificar)', 'Geral'],
      ['TNT sandálias: 32.000 fem + 6.000 masc / TNT bolsas grandes: 10.000', 'Geral'],
      ['TNT liberado para compras acima de R$150 (Rosamango) e qualquer valor (Anna Macedo)', 'Geral'],
      ['Placas de bolsas P e G (2025: 3.500 cada)', 'Geral'],
      ['Coroas/escudo (2025: 50.000 fem + 5.000 masc)', 'Geral'],
      ['Definir embalagens do site (pendência recorrente)', 'Geral'],
      ['Bater quantidades com o time de Compras antes de fechar o pedido', 'Geral']
    ]},
    { secao: 'Festa de Confraternização', itens: [
      ['Ainda não definido em 2025 — decidir data, verba e formato', 'Ano Novo']
    ]},
    { secao: 'Franquias', itens: [
      ['Usaflex: comprar farda oficial de fim de ano para equipe complementar', 'Geral'],
      ['Petite Jolie: comprar farda oficial de fim de ano para equipe complementar e revisar se haverá modelo novo', 'Geral'],
      ['Definir quantidade de embalagens de fim de ano por franquia', 'Geral'],
      ['Influenciadoras para Petite Jolie e Usaflex (marketing)', 'Geral'],
      ['Ação com DJ na Petite com ênfase em customização (cadarço + j-lash)', 'Geral']
    ]}
  ];

  var now = new Date();
  var linhas = [];
  secoes.forEach(function (grupo) {
    var idPai = Utilities.getUuid();
    linhas.push([idPai, '', grupo.secao, 'Geral', STATUS_VALUES[0], now, now]);
    grupo.itens.forEach(function (item) {
      linhas.push([Utilities.getUuid(), idPai, item[0], item[1], STATUS_VALUES[0], now, now]);
    });
  });

  sheet.getRange(sheet.getLastRow() + 1, 1, linhas.length, HEADERS.length).setValues(linhas);
  for (var i = 0; i < linhas.length; i++) {
    applyRowFormatting_(sheet, sheet.getLastRow() - linhas.length + 1 + i);
  }
  return linhas.length;
}

function jsonResponse_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
