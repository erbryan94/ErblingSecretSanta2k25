
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
  let selectedPerson=null;

  const cardsEl = document.getElementById('cards');
  const atEl = document.getElementById('generated-at');
  const btnGen = document.getElementById('btn-generate');
  const btnReset = document.getElementById('btn-reset');
  const linksPanel = document.getElementById('links-panel');
  const linksGrid = document.getElementById('links-grid');
  const copyAllBtn = document.getElementById('copy-all');
  const openAllBtn = document.getElementById('open-all');

  function renderCards(){
    if(!cardsEl) return;
    cardsEl.innerHTML='';
    const people = selectedPerson && assignments ? [selectedPerson] : NAMES;
    const map = assignments || Object.fromEntries(NAMES.map(n=>[n,'—']));
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

  function setGeneratedAt(iso){ if(atEl) atEl.textContent = iso ? new Date(iso).toLocaleString() : '—'; }

  function ensureEncodedSnapshot(){
    const match = location.hash.match(/a=([^&]+)/);
    if(match && match[1]) return match[1];
    if(!assignments) return null;
    const t = new Date().toISOString();
    return encodeState({ map: assignments, t });
  }

  function buildLinks(){
    if(!linksGrid) return;
    linksGrid.innerHTML='';
    const base = location.href.split('#')[0];
    const encoded = ensureEncodedSnapshot();
    if(!encoded){ if(linksPanel) linksPanel.style.display='none'; return; }
    const urls = NAMES.map(name => ({
      name,
      url: `${base}#a=${encoded}&p=${encodeURIComponent(name)}`
    }));
    urls.forEach(({name,url})=>{
      const row = document.createElement('div');
      row.className='link-row';
      row.innerHTML = `<label style="min-width:56px;">${name}</label>
                       <input type="text" readonly value="${url}"/>
                       <button class="btn small">Copy</button>`;
      const input = row.querySelector('input');
      const btn = row.querySelector('button');
      btn.addEventListener('click', async ()=>{
        try{
          await navigator.clipboard.writeText(input.value);
          btn.textContent='Copied!';
          setTimeout(()=>btn.textContent='Copy',1200);
        }catch(_){
          input.select(); document.execCommand('copy');
          btn.textContent='Copied!';
          setTimeout(()=>btn.textContent='Copy',1200);
        }
      });
      linksGrid.appendChild(row);
    });
    if(linksPanel) linksPanel.style.display='block';

    if(copyAllBtn){
      copyAllBtn.onclick = async ()=>{
        const blob = urls.map(u=>`${u.name}: ${u.url}`).join('\n');
        try{ await navigator.clipboard.writeText(blob); copyAllBtn.textContent='Copied!';
        }catch(_){ copyAllBtn.textContent='Select & Copy ↓'; }
        setTimeout(()=>copyAllBtn.textContent='Copy all links',1200);
      };
    }
    if(openAllBtn){
      openAllBtn.onclick = ()=>{
        urls.forEach(u=>window.open(u.url,'_blank','noopener'));
      };
    }
  }

  function applySnapshot(map, t){
    assignments = map;
    revealed = {};
    selectedPerson = null;
    setGeneratedAt(t);
    renderCards();
    if(btnReset) btnReset.disabled = !assignments;
    buildLinks();
  }

  function params(){
    const hash = location.hash.replace(/^#/,''); 
    return new URLSearchParams(hash);
  }

  if(btnGen) btnGen.addEventListener('click',()=>{
    try{
      const map = derangement(NAMES);
      const t = new Date().toISOString();
      applySnapshot(map,t);
      const base = location.href.split('#')[0];
      const encoded = encodeState({map,t});
      try{ history.replaceState(null,'',`${base}#a=${encoded}`); }
      catch(_){ location.hash = `a=${encoded}`; }
      buildLinks();
    }catch(e){ showError((e && e.message) ? e.message : 'Unable to generate assignments'); }
  });

  if(btnReset) btnReset.addEventListener('click',()=>{ revealed={}; renderCards(); });

  (function restore(){
    const ps = params();
    const a = ps.get('a');
    const p = ps.get('p');
    if(a){
      const snap = decodeState(a);
      if(snap){
        applySnapshot(snap.map, snap.t);
        if(p && (p in snap.map)){
          selectedPerson = p;
          renderCards();
        }
        return;
      }
    }
    renderCards();
  })();

  window.addEventListener('hashchange', ()=>{
    const ps = params();
    const a = ps.get('a');
    const p = ps.get('p');
    if(a){
      const snap = decodeState(a);
      if(snap){
        assignments = snap.map;
        setGeneratedAt(snap.t);
        if(p && (p in snap.map)) selectedPerson = p; else selectedPerson = null;
        revealed = {};
        renderCards();
        buildLinks();
      }
    }
  });

  // Self-tests
  (function tests(){
    try{
      const names=["A","B","C","D","E","F"]; const map=derangement(names);
      console.assert(Object.keys(map).length===names.length,'maps all names');
      console.assert(names.every(n=>map[n] && map[n]!==n),'no self-assign');
      const targets=new Set(Object.values(map));
      console.assert(names.every(n=>targets.has(n)),'is permutation');
      const joined=['X','Y'].join('\n');
      console.assert(joined==='X\nY','newline join works');
    }catch(e){}
  })();

})();
