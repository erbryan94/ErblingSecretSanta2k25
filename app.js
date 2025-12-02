(function(){
  const errEl = document.getElementById('err');
  function showError(msg){ if(!errEl) return; errEl.textContent = msg; errEl.style.display = 'block'; }

  const NAMES = ["Katie","Richie","Beth","Bryan","Issy","Reid"];

  function sattolo(arr){
    const a = arr.slice();
    for (let i=a.length-1;i>0;i--){
      const j = Math.floor(Math.random()*i);
      const t=a[i]; a[i]=a[j]; a[j]=t;
    }
    return a;
  }

  function derangement(names){
    if (new Set(names).size!==names.length) throw new Error('Duplicate names');
    if (names.length<2) throw new Error('Need at least 2');
    for(let t=0;t<100;t++){
      const perm=[...names].sort(()=>Math.random()-.5);
      if (perm.every((v,i)=>v!==names[i])){
        const m={}; names.forEach((n,i)=>m[n]=perm[i]); return m;
      }
    }
    const cyc=sattolo(names); const m={}; names.forEach((n,i)=>m[n]=cyc[i]); return m;
  }

  function encodeState(state){
    const json=JSON.stringify(state);
    return btoa(unescape(encodeURIComponent(json)));
  }
  function decodeState(s){
    try{
      const json=decodeURIComponent(escape(atob(s)));
      const obj=JSON.parse(json);
      if(obj && obj.map && obj.t) return obj;
    }catch(e){}
    return null;
  }

  let assignments=null;
  let revealed={};
  let generatedAt=null;

  const viewModeMsg = document.getElementById('view-mode-msg');
  const shareEl = document.getElementById('share');
  const shareListEl = document.getElementById('share-list');

  const cardsEl = document.getElementById('cards');
  const atEl = document.getElementById('generated-at');
  const btnGen = document.getElementById('btn-generate');
  const btnReset = document.getElementById('btn-reset');

  const hashParams = new URLSearchParams(location.hash.replace(/^#/,'') || '');
  const rawPerson = hashParams.get('p');
  const viewerName = rawPerson && NAMES.includes(rawPerson) ? rawPerson : null;

  function renderCards(){
    cardsEl.innerHTML='';
    const people = viewerName ? [viewerName] : NAMES;
    const map = assignments || Object.fromEntries(people.map(n=>[n,'—']))
    people.forEach(person=>{
      const isRevealed=!!revealed[person];
      const receiver = map[person];
      const card=document.createElement('button');
      card.className='card'+(isRevealed?' revealed':'');
      card.innerHTML=`<div class="ribbon">Secret</div>
                      <div class="who">${person}</div>
                      <div class="name">${isRevealed?receiver:'Click to reveal →'}</div>
                      <div class="hint" style="margin-top:8px;color:#64748b;font-size:13px;">${isRevealed?'Shh! Keep it secret.':'Only reveals for this card.'}</div>`;
      card.addEventListener('click',()=>{ if(assignments){ revealed[person]=true; renderCards(); } });
      cardsEl.appendChild(card);
    });
  }

  function setGeneratedAt(iso){ atEl.textContent = iso ? new Date(iso).toLocaleString() : '—'; }
  function renderShareLinks(){
    if(!shareEl || !shareListEl) return;
    shareEl.hidden = !assignments || !!viewerName;
    if(shareEl.hidden) return;

    const encoded = encodeState({map:assignments, t: generatedAt});
    const base = `${location.origin}${location.pathname}`;
    shareListEl.innerHTML='';
    NAMES.forEach(person=>{
      const link = `${base}#a=${encoded}&p=${encodeURIComponent(person)}`;
      const row = document.createElement('div');
      row.className = 'share-row';
      row.innerHTML = `<span class="label">${person}</span>
                       <input type="text" readonly value="${link}" aria-label="Share link for ${person}" />
                       <span class="pill">Personal link</span>`;
      shareListEl.appendChild(row);
    });
  }

  function updateViewMode(){
    if(!viewModeMsg) return;
    if(viewerName){
      viewModeMsg.textContent = `You are viewing the card for ${viewerName}. Only this card can be revealed.`;
    }else{
      viewModeMsg.textContent = 'Click a card to reveal. Share links below to keep assignments secret.';
    }
  }

  function applySnapshot(map, t){
    assignments = map;
    revealed = {};
    generatedAt = t;
    setGeneratedAt(t);
    renderCards();
    renderShareLinks();
    btnReset.disabled = !assignments || !!viewerName;
    btnGen.disabled = !!viewerName;
    updateViewMode();
  }

  btnGen.addEventListener('click',()=>{
    try{
      const map = derangement(NAMES);
      const t = new Date().toISOString();
      applySnapshot(map,t);
      const base = `${location.origin}${location.pathname}`;
      const encoded = encodeState({map,t});
      try{ history.replaceState(null,'',`${base}#a=${encoded}`); }
      catch(_){ location.hash = `a=${encoded}`; }
    }catch(e){ showError((e && e.message) ? e.message : 'Unable to generate assignments'); }
  });

  btnReset.addEventListener('click',()=>{ revealed={}; renderCards(); });

  (function restore(){
    const a = hashParams.get('a');
    if(rawPerson && !viewerName) showError(`Unknown person: ${rawPerson}`);
    if(a){ const snap = decodeState(a); if(snap) { applySnapshot(snap.map, snap.t); return; } }
    updateViewMode();
    renderCards();
  })();

})();
