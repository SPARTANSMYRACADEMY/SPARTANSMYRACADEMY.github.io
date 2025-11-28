/* SPARTANOS MyR ACADEMY - Apps Script backend
   Provee endpoints para:
   - login (POST)
   - register (POST) -> crea usuario con password hashed (cliente usa SHA-256)
   - submitInscription (POST) -> guarda inscripciones
   - getQuestions (GET) -> devuelve preguntas
   - submitResult (POST) -> guarda resultado del simulador
   - listInscripciones (GET, admin)
   
   Ajusta los nombres de hojas si tus tabs se llaman diferente.
*/

const SHEET_USERS = 'Usuarios';
const SHEET_INSCRIP = 'Inscripciones';
const SHEET_PREG = 'Preguntas';
const SHEET_RESULTS = 'Resultados';

function doGet(e){
  const action = (e.parameter.action || '').toLowerCase();
  try{
    if(action === 'getquestions'){
      return getQuestions();
    } else if(action === 'listinscripciones'){
      return listInscripciones(e);
    } else {
      return ContentService.createTextOutput(JSON.stringify({ok:false, error:'action not found'})).setMimeType(ContentService.MimeType.JSON);
    }
  }catch(err){
    return ContentService.createTextOutput(JSON.stringify({ok:false, error:err.toString()})).setMimeType(ContentService.MimeType.JSON);
  }
}

function doPost(e){
  const action = (e.parameter.action || '').toLowerCase();
  const data = e.postData && e.postData.contents ? JSON.parse(e.postData.contents) : {};
  try{
    if(action === 'login'){
      return login(data);
    } else if(action === 'register'){
      return registerUser(data);
    } else if(action === 'submitinscription'){
      return submitInscription(data);
    } else if(action === 'submitresult'){
      return submitResult(data);
    } else {
      return ContentService.createTextOutput(JSON.stringify({ok:false, error:'action not found'})).setMimeType(ContentService.MimeType.JSON);
    }
  }catch(err){
    return ContentService.createTextOutput(JSON.stringify({ok:false, error:err.toString()})).setMimeType(ContentService.MimeType.JSON);
  }
}

/* ------------ HELPERS ------------ */

function _getSheetValues(sheetName){
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(sheetName);
  if(!sh) throw new Error('Hoja no encontrada: ' + sheetName);
  const data = sh.getDataRange().getValues();
  const headers = data.shift();
  return {headers, rows:data};
}

function _appendRow(sheetName, rowArr){
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(sheetName);
  if(!sh) throw new Error('Hoja no encontrada: ' + sheetName);
  sh.appendRow(rowArr);
}

/* ------------ ENDPOINTS ------------ */

function login(data){
  // data: {usuario, passwordHash}
  if(!data.usuario || !data.passwordHash) return _resp(false,'Falta usuario o passwordHash');
  const {headers, rows} = _getSheetValues(SHEET_USERS);
  const idxUser = headers.indexOf('usuario');
  const idxHash = headers.indexOf('passwordHash');
  if(idxUser < 0 || idxHash < 0) return _resp(false,'Formato hoja Usuarios incorrecto. Asegura columnas "usuario" y "passwordHash"');
  const found = rows.find(r => String(r[idxUser]).toLowerCase() === String(data.usuario).toLowerCase());
  if(!found) return _resp(false,'Usuario no encontrado');
  const stored = String(found[idxHash] || '');
  if(stored === String(data.passwordHash)){
    // success - return user metadata
    return _resp(true, {message:'OK', usuario:found[idxUser]});
  } else {
    return _resp(false,'Credenciales inválidas');
  }
}

function registerUser(data){
  // data: {usuario, passwordHash, nombre, email}
  if(!data.usuario || !data.passwordHash) return _resp(false,'Falta usuario o passwordHash');
  const {headers, rows} = _getSheetValues(SHEET_USERS);
  const idxUser = headers.indexOf('usuario');
  if(idxUser < 0) return _resp(false,'Hoja Usuarios deberá tener columna "usuario"');
  const exists = rows.some(r => String(r[idxUser]).toLowerCase() === String(data.usuario).toLowerCase());
  if(exists) return _resp(false,'Usuario ya existe');
  // Build row aligned with headers
  const row = headers.map(h => {
    if(h === 'usuario') return data.usuario || '';
    if(h === 'passwordHash') return data.passwordHash || '';
    if(h === 'nombre') return data.nombre || '';
    if(h === 'email') return data.email || '';
    if(h === 'createdAt') return new Date();
    return '';
  });
  _appendRow(SHEET_USERS, row);
  return _resp(true,'Usuario creado');
}

function submitInscription(data){
  // data: arbitrary form object; we'll write keys as columns if headers exist, else create default format
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET_INSCRIP);
  if(!sh) {
    sh = ss.insertSheet(SHEET_INSCRIP);
    sh.appendRow(['timestamp','nombre','email','telefono','simulador','nota','extra']);
  }
  const timestamp = new Date();
  const nombre = data.nombre || '';
  const email = data.email || '';
  const telefono = data.telefono || '';
  const simulador = data.simulador || '';
  const nota = data.nota || '';
  const extra = data.extra ? JSON.stringify(data.extra) : '';
  _appendRow(SHEET_INSCRIP, [timestamp, nombre, email, telefono, simulador, nota, extra]);
  return _resp(true,'Inscripción guardada');
}

function getQuestions(){
  const {headers, rows} = _getSheetValues(SHEET_PREG);
  // Expects columns: id, simulador, pregunta, opciones (JSON array o separadas por || ), respuesta (index o valor)
  const questions = rows.map(r => {
    const obj = {};
    headers.forEach((h,i)=> obj[h] = r[i]);
    // normalize opciones
    if(obj.opciones && String(obj.opciones).trim()){
      try{
        obj.opciones = JSON.parse(obj.opciones);
      }catch(e){
        obj.opciones = String(obj.opciones).split('||').map(s=>s.trim());
      }
    } else {
      obj.opciones = [];
    }
    return obj;
  });
  return ContentService.createTextOutput(JSON.stringify({ok:true, questions})).setMimeType(ContentService.MimeType.JSON);
}

function submitResult(data){
  // data: {usuario, simulador, score, maxScore, details}
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET_RESULTS);
  if(!sh){
    sh = ss.insertSheet(SHEET_RESULTS);
    sh.appendRow(['timestamp','usuario','simulador','score','maxScore','details']);
  }
  const row = [new Date(), data.usuario||'', data.simulador||'', data.score||0, data.maxScore||0, data.details ? JSON.stringify(data.details) : ''];
  _appendRow(SHEET_RESULTS, row);
  return _resp(true,'Resultado guardado');
}

function listInscripciones(e){
  // optionally allow ?limit=50
  const limit = parseInt(e.parameter.limit || '200',10);
  const {headers, rows} = _getSheetValues(SHEET_INSCRIP);
  const out = rows.slice(-limit).map(r => {
    const obj = {};
    headers.forEach((h,i)=> obj[h] = r[i]);
    return obj;
  });
  return ContentService.createTextOutput(JSON.stringify({ok:true, rows: out})).setMimeType(ContentService.MimeType.JSON);
}

/* utils */
function _resp(ok, payload){
  if(ok === true){
    return ContentService.createTextOutput(JSON.stringify({ok:true, data:payload})).setMimeType(ContentService.MimeType.JSON);
  } else {
    return ContentService.createTextOutput(JSON.stringify({ok:false, error:payload})).setMimeType(ContentService.MimeType.JSON);
  }
}
