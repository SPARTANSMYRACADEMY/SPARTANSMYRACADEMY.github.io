// CONFIG: pega aquí la URL de tu Web App (Apps Script) que obtendrás al desplegar
const API_BASE = 'https://script.google.com/macros/s/REPLACE_WITH_YOUR_DEPLOY_ID/exec';

// util: POST JSON
async function apiPost(action, payload){
  const url = API_BASE + '?action=' + encodeURIComponent(action);
  const res = await fetch(url, {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify(payload)
  });
  return res.json();
}
async function apiGet(action){
  const url = API_BASE + '?action=' + encodeURIComponent(action);
  const res = await fetch(url);
  return res.json();
}

// hashing SHA-256 (returns hex)
async function sha256hex(str){
  const enc = new TextEncoder();
  const data = enc.encode(str);
  const hash = await crypto.subtle.digest('SHA-256', data);
  const hex = Array.from(new Uint8Array(hash)).map(b=>b.toString(16).padStart(2,'0')).join('');
  return hex;
}

/* --- AUTH --- */
document.getElementById('btnLogin').addEventListener('click', async ()=>{
  const u = document.getElementById('userLogin').value.trim();
  const p = document.getElementById('passLogin').value;
  if(!u||!p) return alert('Completa usuario y contraseña');
  const ph = await sha256hex(p);
  const r = await apiPost('login',{usuario:u,passwordHash:ph});
  if(r && r.ok){
    onLoginSuccess(u);
    alert('Bienvenido ' + u);
  } else {
    alert('Login falló: ' + (r && r.error || 'credenciales'));
  }
});

document.getElementById('btnRegister').addEventListener('click', async ()=>{
  const u = document.getElementById('newUser').value.trim();
  const p = document.getElementById('newPass').value;
  const n = document.getElementById('newName').value || '';
  const e = document.getElementById('newEmail').value || '';
  if(!u||!p) return alert('Usuario y contraseña requeridos');
  const ph = await sha256hex(p);
  const r = await apiPost('register',{usuario:u,passwordHash:ph,nombre:n,email:e});
  if(r && r.ok){
    alert('Usuario creado. Inicia sesión.');
  } else {
    alert('Error: ' + (r && r.error));
  }
});

function onLoginSuccess(usuario){
  localStorage.setItem('sp_user', usuario);
  document.getElementById('loginForm').style.display = 'none';
  document.getElementById('adminPanel').style.display = 'block';
  loadInscripciones();
}

document.getElementById('btnLogout').addEventListener('click', ()=>{
  localStorage.removeItem('sp_user');
  document.getElementById('loginForm').style.display = 'block';
  document.getElementById('adminPanel').style.display = 'none';
});

/* load inscripciones */
async function loadInscripciones(){
  const r = await apiGet('listinscripciones&limit=200');
  if(r && r.ok){
    document.getElementById('inscriptionsOutput').textContent = JSON.stringify(r.rows, null, 2);
  } else {
    document.getElementById('inscriptionsOutput').textContent = 'Error: ' + (r && r.error || 'no data');
  }
}

/* --- SIMULADORES --- */
const simListEl = document.getElementById('simList');
async function initSimuladores(){
  const res = await apiGet('getquestions');
  if(!res || !res.ok) return;
  // group by simulador
  const bySim = {};
  res.questions.forEach(q=>{
    const sim = q.simulador || 'General';
    bySim[sim] = bySim[sim] || [];
    bySim[sim].push(q);
  });
  // render cards
  Object.keys(bySim).forEach(sim=>{
    const div = document.createElement('div');
    div.className = 'sim-card';
    div.innerHTML = `<h4>${sim}</h4><p>${bySim[sim].length} preguntas</p><button class="btn" data-sim="${sim}">Iniciar</button>`;
    simListEl.appendChild(div);
  });
  // attach click
  simListEl.addEventListener('click', (ev)=>{
    const btn = ev.target.closest('button[data-sim]');
    if(!btn) return;
    const sim = btn.dataset.sim;
    openSimModal(sim, bySim[sim]);
  });
}

function openSimModal(sim, questions){
  const modal = document.getElementById('simModal');
  modal.setAttribute('aria-hidden','false');
  const container = document.getElementById('simContainer');
  container.innerHTML = '';
  const form = document.createElement('div');
  form.innerHTML = `<h3>${sim}</h3><div id="qwrap"></div><button id="submitSim" class="btn">Enviar</button>`;
  container.appendChild(form);
  const qwrap = document.getElementById('qwrap');
  questions.forEach((q, idx)=>{
    const qdiv = document.createElement('div');
    qdiv.style.marginBottom='12px';
    qdiv.innerHTML = `<strong>${idx+1}. ${q.pregunta}</strong>`;
    q.opciones.forEach((opt, oi)=>{
      const id = `q${idx}_o${oi}`;
      qdiv.innerHTML += `<div><label><input type="radio" name="q${idx}" value="${oi}" /> ${opt}</label></div>`;
    });
    qwrap.appendChild(qdiv);
  });
  document.getElementById('submitSim').onclick = async ()=>{
    // grade
    let score = 0;
    const details = [];
    questions.forEach((q, idx)=>{
      const radios = document.getElementsByName('q'+idx);
      let sel = null;
      for(const r of radios){ if(r.checked) sel = r.value; }
      const correct = q.respuesta !== undefined && q.respuesta !== '' ? String(q.respuesta) : null;
      const correctIdx = isNaN(Number(correct)) ? null : String(Number(correct));
      if(correctIdx !== null && sel !== null && String(sel) === correctIdx){ score+=1; }
      details.push({pregunta:q.pregunta, selected: sel, correct: correctIdx});
    });
    const maxScore = questions.length;
    const usuario = localStorage.getItem('sp_user') || 'invitado';
    // send to backend
    await apiPost('submitresult',{usuario,simulador:sim,score, maxScore, details});
    // optionally send an inscription row
    await apiPost('submitinscription',{nombre:usuario,email:'',telefono:'',simulador:sim,nota:score});
    alert(`Tu puntaje: ${score}/${maxScore}`);
    closeModal();
  };
}
document.getElementById('closeModal').addEventListener('click', closeModal);
function closeModal(){ document.getElementById('simModal').setAttribute('aria-hidden','true'); }

/* UI small: hamburger menu and init */
document.getElementById('menuBtn').addEventListener('click', ()=>{
  const nl = document.getElementById('navLinks');
  nl.style.display = nl.style.display === 'block' ? 'none' : 'block';
});

document.getElementById('openSim').addEventListener('click', ()=> location.href='#formularios');

/* init */
initSimuladores();
