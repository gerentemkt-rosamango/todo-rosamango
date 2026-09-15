/**
 * Backend do TODO List Rosamango — Google Apps Script Web App.
 * Planilha vinculada funciona como banco de dados; deploy via scripts/deploy.ps1 (clasp).
 * Publicado com access "ANYONE_ANONYMOUS" (ver appsscript.json) para editar sem login.
 */

var SHEET_NAME = 'Tarefas';
var HEADERS = ['ID', 'Texto', 'Categoria', 'Status', 'CriadoEm', 'AtualizadoEm'];
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
    texto: row[1],
    categoria: row[2] || 'Geral',
    status: row[3] || STATUS_VALUES[0],
    criadoEm: row[4],
    atualizadoEm: row[5]
  };
}

function createTask_(sheet, payload) {
  var texto = (payload.texto || '').toString().trim();
  if (!texto) throw new Error('Texto da tarefa é obrigatório.');
  var categoria = payload.categoria || 'Geral';
  var now = new Date();
  var id = Utilities.getUuid();
  sheet.appendRow([id, texto, categoria, STATUS_VALUES[0], now, now]);
  applyRowFormatting_(sheet, sheet.getLastRow());
  return rowToTask_([id, texto, categoria, STATUS_VALUES[0], now, now]);
}

function updateTask_(sheet, payload) {
  var rowIndex = findRowById_(sheet, payload.id);
  if (rowIndex === -1) throw new Error('Tarefa não encontrada: ' + payload.id);

  var range = sheet.getRange(rowIndex, 1, 1, HEADERS.length);
  var row = range.getValues()[0];

  if (typeof payload.texto === 'string' && payload.texto.trim()) row[1] = payload.texto.trim();
  if (typeof payload.categoria === 'string' && payload.categoria) row[2] = payload.categoria;
  if (typeof payload.status === 'string') {
    if (STATUS_VALUES.indexOf(payload.status) === -1) throw new Error('Status inválido: ' + payload.status);
    row[3] = payload.status;
  }
  row[5] = new Date();

  range.setValues([row]);
  applyRowFormatting_(sheet, rowIndex);
  return rowToTask_(row);
}

function deleteTask_(sheet, payload) {
  var rowIndex = findRowById_(sheet, payload.id);
  if (rowIndex === -1) return false;
  sheet.deleteRow(rowIndex);
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
  sheet.setColumnWidth(2, 360);
  sheet.setColumnWidth(3, 120);
  sheet.setColumnWidth(4, 130);
  sheet.setColumnWidth(5, 140);
  sheet.setColumnWidth(6, 140);
  sheet.hideColumns(1);

  var statusRange = sheet.getRange(2, 4, 998, 1);
  var rule = SpreadsheetApp.newDataValidation().requireValueInList(STATUS_VALUES, true).setAllowInvalid(false).build();
  statusRange.setDataValidation(rule);

  applyStatusConditionalFormatting_(sheet);
  return sheet;
}

function applyStatusConditionalFormatting_(sheet) {
  var range = sheet.getRange(2, 4, 998, 1);
  var rules = sheet.getConditionalFormatRules().filter(function (r) {
    return r.getRanges().every(function (rg) { return rg.getColumn() !== 4; });
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
  var categoriaCell = sheet.getRange(rowIndex, 3);
  var categoria = categoriaCell.getValue();
  var color = CATEGORY_COLORS[categoria] || CATEGORY_COLORS['Geral'];
  categoriaCell.setBackground(color);
}

function jsonResponse_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
