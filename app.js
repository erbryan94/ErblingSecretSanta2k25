
(function(){
  const errEl = document.getElementById('err');
  function showError(msg){ if(!errEl) return; errEl.textContent = msg; errEl.style.display = 'block'; }

  // === Participants (7) ===
  const NAMES = ["Katie","Richie","Beth","Bryan","Issy","Reid","Kory"];

  // === Couple constraints (no giving to each other, both directions) ===
  const COUPLES = [
    ["Issy","Bryan"],
    ["Beth","Kory"],
    ["Katie","Reid"]
  ];

  // Build forbidden receiver set per giver: self + partner (both directions)
  const FORBID = Object.fromEntries(NAMES.map(n => [n, new Set([n])]));
  for (const [a,b] of COUPLES){
    if (FORBID[a]) FORBID[a].add(b);
    if (FORBID[b]) FORBID[b].add(a);
  }

  // --- Constrained matching via randomized backtracking ---
  function makeConstrainedAssignment(names){
    const receivers = [...names];
    receivers.sort(() => Math.random() - 0.5);
    const givers = [...names].sort(() => Math.random() - 0.5);
    const used = new Set();
    const map = {};

    function dfs(i){
      if (i === givers.length) return true;
      const giver = givers[i];
      const options = receivers.filter(r => !used.has(r) && !FORBID[giver].has(r));
      options.sort(() => Math.random() - 0.5);
      for (const r of options){
        map[giver] = r;
        used.add(r);
        if (dfs(i+1)) return true;
        used.delete(r);
        delete map[giver];
      }
      return false;
    }

    for (let tries=0; tries<200; tries++){
      used.clear?.();
      for (const k in map) delete map[k];
      receivers.sort(() => Math.random() - 0.5);
      givers.sort(() => Math.random() - 0.5);
      if (dfs(0)) return map;
    }
    throw new Error("Could not generate a valid assignment with the given constraints.");
  }

  // URL state
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

  // State
  let assignments=null;
  let revealed={};
  let selectedPerson=null;

  // DOM
  const cardsEl = document.getElementById('cards');
  const atEl = document.getElementById('generated-at');
  const btnGen = document.getElementById('btn-generate');
  const btnReset = document.getElementById('btn-reset');
  const linksPanel = document.getElementById('links-panel');
  const linksGrid = document.getElementById('links-grid');
  const copyAllBtn = document.getElementById('copy-all');
  const openAllBtn = document.getElementById('open-all');
  const controls = document.getElementById('controls');
  const footer = document.getElementById('footer');
  const subtitle = document.getElementById('subtitle');

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
      openAllBtn.onclick = ()=>{ urls.forEach(u=>window.open(u.url,'_blank','noopener')); };
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

  // Generate
  if(btnGen) btnGen.addEventListener('click',()=>{
    try{
      const map = makeConstrainedAssignment(NAMES);
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

  // Initial restore + per-person view
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
          // Hide controls & links for per-person privacy view
          if(controls) controls.classList.add('hidden');
          if(linksPanel) linksPanel.classList.add('hidden');
          if(footer) footer.classList.add('hidden');
          if(subtitle) subtitle.textContent = "Click your card to reveal your match.";
          renderCards();
        } else {
          // Host view: show controls and links
          if(controls) controls.classList.remove('hidden');
          if(linksPanel) linksPanel.classList.remove('hidden');
          if(footer) footer.classList.remove('hidden');
          if(subtitle) subtitle.textContent = "Generate once, then send each person their private link below.";
        }
        return;
      }
    }
    renderCards();
  })();

  // Hash changes (e.g., switching between per-person links and host link)
  window.addEventListener('hashchange', ()=>{
    const ps = params();
    const a = ps.get('a');
    const p = ps.get('p');
    if(a){
      const snap = decodeState(a);
      if(snap){
        assignments = snap.map;
        setGeneratedAt(snap.t);
        revealed = {};
        if(p && (p in snap.map)){
          selectedPerson = p;
          if(controls) controls.classList.add('hidden');
          if(linksPanel) linksPanel.classList.add('hidden');
          if(footer) footer.classList.add('hidden');
          if(subtitle) subtitle.textContent = "Click your card to reveal your match.";
        } else {
          selectedPerson = null;
          if(controls) controls.classList.remove('hidden');
          if(linksPanel) linksPanel.classList.remove('hidden');
          if(footer) footer.classList.remove('hidden');
          if(subtitle) subtitle.textContent = "Generate once, then send each person their private link below.";
        }
        renderCards();
        buildLinks();
      }
    }
  });

  // Self-tests
  (function tests(){
    try{
      // Construct a fake constraint set and verify
      const names=["A","B","C","D","E","F","G"];
      const couples=[["A","B"],["C","D"],["E","F"]];
      const forbid = Object.fromEntries(names.map(n=>[n,new Set([n])]));
      for(const [x,y] of couples){ forbid[x].add(y); forbid[y].add(x); }
      function gen(names){
        const rec=[...names]; const giv=[...names];
        rec.sort(()=>Math.random()-.5); giv.sort(()=>Math.random()-.5);
        const used=new Set(); const m={};
        function dfs(i){
          if(i===giv.length) return true;
          const g=giv[i];
          const opts=rec.filter(r=>!used.has(r) && !forbid[g].has(r));
          for(const r of opts){ m[g]=r; used.add(r); if(dfs(i+1)) return true; used.delete(r); delete m[g]; }
          return false;
        }
        if(!dfs(0)) throw new Error('no match');
        return m;
      }
      const m=gen(names);
      console.assert(names.every(n=>m[n] && m[n]!==n),'no self');
      console.assert(couples.every(([x,y])=>m[x]!==y && m[y]!==x),'no couples');
    }catch(e){}
  })();

})();
