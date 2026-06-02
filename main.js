'use strict';

function toggleSection(el) {
  el.closest('.collapsible').classList.toggle('open');
}

const game = (() => {
  const COLS = 20, ROWS = 10, T_PX = 48;

  const T = {
    empty:'empty', output:'output',
    ore_i:'ore_i',  ore_p:'ore_p',  ore_c:'ore_c',
    min_i:'min_i',  min_p:'min_p',  min_c:'min_c',
    b_r:'b_r', b_l:'b_l', b_d:'b_d', b_u:'b_u',
    compiler:'compiler', qa_gate:'qa_gate',
    change_board:'change_board', hana_db:'hana_db',
    sm36:'sm36', stms:'stms', oss:'oss', bw_dtp:'bw_dtp', splitter:'splitter', rnd:'rnd',
  };

  const ORE_TILES  = new Set([T.ore_i, T.ore_p, T.ore_c]);
  const MIN_TILES  = new Set([T.min_i, T.min_p, T.min_c]);
  const BELT_TILES = new Set([T.b_r, T.b_l, T.b_d, T.b_u]);
  const PROC_TILES = new Set([T.compiler, T.qa_gate, T.change_board, T.hana_db]);
  const BELT_MOVE  = { b_r:{dx:1,dy:0}, b_l:{dx:-1,dy:0}, b_d:{dx:0,dy:1}, b_u:{dx:0,dy:-1} };
  const ORE_TO_MIN = { ore_i:'min_i', ore_p:'min_p', ore_c:'min_c' };
  const MIN_TO_ORE = { min_i:'ore_i', min_p:'ore_p', min_c:'ore_c' };
  const ORE_TYPE   = { ore_i:'incident', ore_p:'problem', ore_c:'change',
                       min_i:'incident', min_p:'problem', min_c:'change' };

  const STAGE_MULT  = [1.0, 1.5, 2.1, 3.2, 4.8];
  const STAGE_LABEL = ['RAW','TR','QA✓','CR✓','HANA'];
  const STAGE_CLS   = ['','s-tr','s-qa','s-cr','s-hana'];

  const REQ = {
    incident: { value:50,  icon:'INC', cls:'item-inc' },
    problem:  { value:150, icon:'PRB', cls:'item-prb' },
    change:   { value:400, icon:'CHG', cls:'item-chg' },
  };

  const PROC_CFG = {
    [T.compiler]:     { needStage:0, ticks:2, outStage:1 },
    [T.qa_gate]:      { needStage:1, ticks:1, outStage:2 },
    [T.change_board]: { needStage:2, ticks:3, outStage:3 },
    [T.hana_db]:      { needStage:3, ticks:2, outStage:4 },
  };
  const PROC_DEFAULTS = { compiler:2, qa_gate:1, change_board:3, hana_db:2 };
  const COSTS = { miner:100, belt:5, compiler:150, qa_gate:100, change_board:200, hana_db:350 };

  // ── RESEARCH ───────────────────────────────────────────────────────────────
  const RESEARCH = {
    budget_analyst:   { label:'Budget Analyst',    icon:'💰',  tier:0, desc:'+10% payouts',         cost:250,  req:[],                              apply(s){s.globalMult*=1.10} },
    fast_mining:      { label:'Fast Mining',        icon:'⚡',  tier:0, desc:'Mining 3s → 2s',       cost:300,  req:[],                              apply(s){s.minerInterval=2} },
    fast_compile:     { label:'Fast Compile',       icon:'⚙',  tier:0, desc:'Compiler 2s → 1s',     cost:400,  req:[],                              apply(){PROC_CFG[T.compiler].ticks=1} },
    auto_qa:          { label:'Auto QA',            icon:'🔬', tier:0, desc:'QA Gate instant',       cost:500,  req:[],                              apply(){PROC_CFG[T.qa_gate].ticks=0} },
    cost_optimizer:   { label:'Cost Optimizer',     icon:'💰💰',tier:1, desc:'+20% payouts',         cost:600,  req:['budget_analyst'],              apply(s){s.globalMult*=1.20} },
    turbo_mining:     { label:'Turbo Mining',       icon:'⚡⚡',tier:1, desc:'Mining 2s → 1s',       cost:800,  req:['fast_mining'],                 apply(s){s.minerInterval=1} },
    instant_compile:  { label:'Instant Compile',    icon:'⚙⚙', tier:1, desc:'Compiler 1s → 0s',    cost:1200, req:['fast_compile'],                apply(){PROC_CFG[T.compiler].ticks=0} },
    compliance:       { label:'Compliance Module',  icon:'📋', tier:1, desc:'Odemkne Change Board',  cost:600,  req:['auto_qa'],                     apply(s){s.unlocked.add('change_board')} },
    belt_express:     { label:'Express Belt',       icon:'🚄', tier:2, desc:'Belty 2× rychleji',     cost:1000, req:['turbo_mining'],                apply(s){s.beltPasses=2} },
    ai_optimizer:     { label:'SAP AI Optimizer',   icon:'🤖', tier:2, desc:'Hodnoty +30%',          cost:2000, req:['instant_compile','compliance'],apply(s){s.globalMult*=1.30} },
    hana_module:      { label:'HANA DB Module',     icon:'🗄️', tier:2, desc:'Odemkne HANA DB',       cost:1500, req:['compliance','cost_optimizer'], apply(s){s.unlocked.add('hana_db')} },
    cloud_integration:{ label:'Cloud Integration',  icon:'☁️', tier:3, desc:'×1.5 všechny hodnoty', cost:4000, req:['ai_optimizer','hana_module'],  apply(s){s.globalMult*=1.50} },
    devops_pipeline:  { label:'DevOps Pipeline',    icon:'🔄', tier:3, desc:'Change Board 3s → 1s', cost:2500, req:['belt_express','hana_module'],  apply(){PROC_CFG[T.change_board].ticks=1} },
  };

  // ── KEYBOARD MAP ───────────────────────────────────────────────────────────
  const KEY_TOOLS = {
    'q':'miner',
    'w':'b_u', 'a':'b_l', 's':'b_d', 'd':'b_r',
    'e':'compiler', 'r':'qa_gate', 't':'change_board', 'y':'hana_db',
    'x':'delete',
    'z':'sm36', 'u':'stms', 'i':'oss', 'o':'bw_dtp', 'f':'splitter',
    'p':'output', 'l':'rnd',   // aliases
  };

  const MAP_SRC = [
    '. . . . . . . . . . . . . . . . . . . .',
    '. . i i i . . . . . . . . . . . . . . .',
    '. . i i . . . . . . . . . . . . . . . .',
    '. . . . . . . . . . . . . . . . . . . .',
    '. . . . . p p p . . . . . . . . O . . .',
    '. . . . . p p . . . . . . . . . . . . .',
    '. . . . . . . . . . . . . . . . . . . .',
    '. . . . . . . . . c c c . . . . . . . .',
    '. . . . . . . . . c c . . . . . . . . .',
    '. . . . . . . . . . . . . . . . . . . .',
  ];

  function parseMap() {
    return MAP_SRC.map(r => r.split(' ').map(c =>
      c==='i'?T.ore_i:c==='p'?T.ore_p:c==='c'?T.ore_c:c==='O'?T.output:T.empty
    ));
  }

  // ── STATE ──────────────────────────────────────────────────────────────────
  const state = {
    budget:500, totalDeploys:0, tickBudget:0,
    grid:parseMap(), items:[], miners:[],
    tool:'miner', nextId:0,
    researched:new Set(), unlocked:new Set(['compiler','qa_gate']),
    minerInterval:3, globalMult:1.0, beltPasses:1,
    paused:true,
    rp:0,
    deploysLastMin:[], // timestamps of last 60s deploys for RPM
  };

  const $ = id => document.getElementById(id);
  let cellEls = [];
  const itemEls = {};

  function fmt(n) {
    if (n>=1_000_000) return (n/1_000_000).toFixed(1)+'M';
    if (n>=1_000)     return (n/1_000).toFixed(1)+'k';
    return Math.floor(n).toString();
  }

  function eventLog(msg, cls='') {
    const el=$('event-log'), p=document.createElement('p');
    if(cls)p.className=cls; p.textContent=msg; el.prepend(p);
    while(el.children.length>60)el.lastChild.remove();
  }

  function toast(msg, ms=2800) {
    const el=$('event-banner');
    el.textContent=msg; el.classList.remove('hidden');
    clearTimeout(toast._t);
    toast._t=setTimeout(()=>el.classList.add('hidden'),ms);
  }

  // ── GRID ───────────────────────────────────────────────────────────────────
  function buildGrid() {
    const g=$('game-grid');
    g.style.cssText=`grid-template-columns:repeat(${COLS},${T_PX}px);grid-template-rows:repeat(${ROWS},${T_PX}px);width:${COLS*T_PX}px;height:${ROWS*T_PX}px;`;
    g.innerHTML='';
    cellEls=Array.from({length:ROWS},(_,y)=>Array.from({length:COLS},(_,x)=>{
      const d=document.createElement('div');
      d.className='gc';
      d.addEventListener('click',()=>onCell(x,y));
      g.appendChild(d); return d;
    }));
  }

  const TILE_ICON={[T.min_i]:'⛏',[T.min_p]:'⛏',[T.min_c]:'⛏',
    [T.b_r]:'',[T.b_l]:'',[T.b_d]:'',[T.b_u]:'',
    [T.output]:'🏭',[T.compiler]:'⚙',[T.qa_gate]:'✔',[T.change_board]:'📋',[T.hana_db]:'🗄',
    [T.rnd]:'🔬',[T.sm36]:'⏱',[T.stms]:'🚌',[T.oss]:'📝',[T.bw_dtp]:'📊',[T.splitter]:'⊕'};

  function renderGrid() {
    for(let y=0;y<ROWS;y++) for(let x=0;x<COLS;x++){
      const t=state.grid[y][x],el=cellEls[y][x];
      el.className=`gc t-${t}`; el.textContent=TILE_ICON[t]??'';
    }
  }

  function clearItemEls() {
    Object.values(itemEls).forEach(el=>el.parentNode&&el.remove());
    Object.keys(itemEls).forEach(k=>delete itemEls[k]);
  }

  function iLabel(it){return it.delay>0?'⚙':STAGE_LABEL[it.stage];}
  function iCls(it){
    const sc=STAGE_CLS[it.stage]??'';
    return `world-item ${REQ[it.type].cls}${sc?' '+sc:''}${it.delay>0?' proc':''}`;
  }

  function renderItems() {
    const live=new Set(state.items.map(i=>i.id));
    for(const it of state.items){
      const lx=it.x*T_PX+T_PX/2-15,ly=it.y*T_PX+T_PX/2-15;
      const lbl=iLabel(it),cls=iCls(it);
      if(!itemEls[it.id]){
        const el=document.createElement('div');
        el.textContent=lbl;el.className=cls;
        $('game-grid').appendChild(el);
        itemEls[it.id]=el;
        el.style.transition='none';
        el.style.left=lx+'px';el.style.top=ly+'px';
        requestAnimationFrame(()=>requestAnimationFrame(()=>{el.style.transition='';}));
      } else {
        const el=itemEls[it.id];
        if(el.textContent!==lbl)el.textContent=lbl;
        if(el.className!==cls)el.className=cls;
        el.style.left=lx+'px';el.style.top=ly+'px';
      }
    }
    for(const id in itemEls){if(!live.has(+id)){itemEls[id].remove();delete itemEls[id];}}
  }

  // ── CELL CLICK ─────────────────────────────────────────────────────────────
  function onCell(x,y){
    if(state.paused)return;
    const tool=state.tool,t=state.grid[y][x];
    if(tool==='delete'){
      if(MIN_TILES.has(t)){state.miners=state.miners.filter(m=>!(m.x===x&&m.y===y));state.grid[y][x]=MIN_TO_ORE[t];}
      else if(BELT_TILES.has(t)||PROC_TILES.has(t)||t===T.output||t===T.rnd)state.grid[y][x]=T.empty;
      renderGrid();updateUI();return;
    }
    if(tool==='miner'){
      if(!ORE_TILES.has(t)){toast('⛏ Klikni na barevný ore patch!');return;}
      if(state.budget<COSTS.miner){toast(`❌ Potřebuješ ${COSTS.miner} CZK`);return;}
      state.budget-=COSTS.miner;
      state.grid[y][x]=ORE_TO_MIN[t];
      state.miners.push({x,y,type:ORE_TYPE[t],timer:state.minerInterval});
      eventLog(`⛏ Miner [${ORE_TYPE[t].slice(0,3).toUpperCase()}] → (${x},${y})`,'good');
      renderGrid();updateUI();return;
    }
    if(PROC_TILES.has(T[tool])){
      if(!state.unlocked.has(tool)){toast('🔒 Odemkni výzkumem!');return;}
      if(t!==T.empty){toast('Musí být prázdné pole!');return;}
      if(state.budget<COSTS[tool]){toast(`❌ Potřebuješ ${COSTS[tool]} CZK`);return;}
      state.budget-=COSTS[tool];state.grid[y][x]=T[tool];
      const n={compiler:'ABAP Compiler',qa_gate:'QA Gate',change_board:'Change Board',hana_db:'HANA DB'};
      eventLog(`🏗 ${n[tool]} postaven (${x},${y})`,'good');
      renderGrid();updateUI();return;
    }
    if(BELT_TILES.has(tool)){
      if(t!==T.empty){toast('Belt jen na prázdné pole!');return;}
      if(state.budget<COSTS.belt){toast(`❌ Potřebuješ ${COSTS.belt} CZK`);return;}
      state.budget-=COSTS.belt;state.grid[y][x]=tool;
      renderGrid();updateUI();return;
    }
    // Special placeable tiles: output (PRD Station) and rnd (R&D Lab)
    const SPECIAL_COSTS={output:400,rnd:500,sm36:200,oss:280,splitter:50};
    const SPECIAL_NAMES={output:'PRD Deploy Station',rnd:'R&D Lab',sm36:'SM36 Scheduler',oss:'OSS Note Scanner',splitter:'Splitter'};
    if(tool in SPECIAL_COSTS){
      if(t!==T.empty){toast('Musí být prázdné pole!');return;}
      const cost=SPECIAL_COSTS[tool];
      if(state.budget<cost){toast(`❌ Potřebuješ ${cost} CZK`);return;}
      state.budget-=cost;state.grid[y][x]=T[tool]??tool;
      eventLog(`🏗 ${SPECIAL_NAMES[tool]} postaven (${x},${y})`,'good');
      renderGrid();updateUI();return;
    }
  }

  // ── TOOL SELECT ────────────────────────────────────────────────────────────
  function selectTool(tool){
    state.tool=tool;
    // Hotbar active state
    document.querySelectorAll('.hb-slot').forEach(b=>b.classList.remove('active'));
    const hbEl=$('hb-'+tool.replace(/_/g,'-'));
    if(hbEl)hbEl.classList.add('active');
    // Build menu active state
    document.querySelectorAll('.bm-item[data-tool]').forEach(el=>
      el.classList.toggle('bmi-active',el.dataset.tool===tool));
    // Hint
    const locked=PROC_TILES.has(T[tool])&&!state.unlocked.has(tool);
    const cfg=PROC_CFG[T[tool]];
    const hints={
      miner:`⛏ [Q] Klikni na ore patch · item každé ${state.minerInterval}s · 100 CZK`,
      b_r:'▶ [D] Belt doprava · 5 CZK', b_l:'◀ [A] Belt doleva · 5 CZK',
      b_d:'▼ [S] Belt dolů · 5 CZK',   b_u:'▲ [W] Belt nahoru · 5 CZK',
      compiler:cfg?`⚙ [E] ABAP Compiler · RAW→TR · ${cfg.ticks}s · ×1.5 · 150 CZK`:'',
      qa_gate:locked?'✔ [R] QA Gate · 🔒':cfg?`✔ [R] QA Gate · TR→QA✓ · ${cfg.ticks}s · ×1.4 · 100 CZK`:'',
      change_board:locked?'📋 [T] Change Board · 🔒 Výzkum: Compliance':`📋 [T] Change Board · QA✓→CR✓ · ${PROC_CFG[T.change_board].ticks}s · 200 CZK`,
      hana_db:locked?'🗄 [Y] HANA DB · 🔒 Výzkum: HANA Module':`🗄 [Y] HANA DB · CR✓→HANA · ${PROC_CFG[T.hana_db].ticks}s · 350 CZK`,
      delete:'❌ [X] Smaže budovu nebo belt (zdarma)',
    };
    $('tool-hint').textContent=hints[tool]??'';
  }

  // ── BUILD MENU ─────────────────────────────────────────────────────────────
  function updateBuildMenu(){
    // Lock/unlock proc items
    document.querySelectorAll('.bm-item[data-lock]').forEach(el=>{
      const locked=!state.unlocked.has(el.dataset.lock);
      el.classList.toggle('bm-locked',locked);
    });
    // Affordability (dim if can't afford but not locked)
    document.querySelectorAll('.bm-item[data-cost]').forEach(el=>{
      const cost=parseInt(el.dataset.cost)||0;
      const locked=el.classList.contains('bm-locked');
      el.classList.toggle('bm-dim',!locked&&cost>0&&state.budget<cost);
    });
    // Active tool highlight
    document.querySelectorAll('.bm-item[data-tool]').forEach(el=>
      el.classList.toggle('bmi-active',el.dataset.tool===state.tool));
  }

  // ── BUILD MENU DRAG ────────────────────────────────────────────────────────
  let _bmDrag={active:false,ox:0,oy:0,startX:0,startY:0};
  let _bmPos={left:null,top:null}; // null = centered (CSS default)

  function _bmApplyPos(){
    const panel=$('bm-panel');if(!panel)return;
    if(_bmPos.left!==null){
      panel.style.left=_bmPos.left+'px';
      panel.style.top=_bmPos.top+'px';
      panel.style.transform='none';
    } else {
      panel.style.left='';panel.style.top='';panel.style.transform='';
    }
  }

  function _bmHeaderDown(e){
    const panel=$('bm-panel');if(!panel)return;
    if(e.button!==0)return;
    const r=panel.getBoundingClientRect();
    _bmDrag.active=true;
    _bmDrag.ox=e.clientX-(_bmPos.left??r.left);
    _bmDrag.oy=e.clientY-(_bmPos.top??r.top);
    panel.style.cursor='grabbing';
    e.preventDefault();
  }

  document.addEventListener('mousemove',e=>{
    if(!_bmDrag.active)return;
    const panel=$('bm-panel');if(!panel)return;
    const pw=panel.offsetWidth,ph=panel.offsetHeight;
    let nx=e.clientX-_bmDrag.ox,ny=e.clientY-_bmDrag.oy;
    nx=Math.max(0,Math.min(window.innerWidth-pw,nx));
    ny=Math.max(0,Math.min(window.innerHeight-ph,ny));
    _bmPos.left=nx;_bmPos.top=ny;
    _bmApplyPos();
  });

  document.addEventListener('mouseup',()=>{
    if(!_bmDrag.active)return;
    _bmDrag.active=false;
    const panel=$('bm-panel');if(panel)panel.style.cursor='';
  });

  function openBuildMenu(){
    updateBuildMenu();
    const bm=$('build-menu-modal');
    if(!bm)return;
    bm.classList.remove('hidden');
    // Wire drag on header (only once)
    const hdr=$('bm-header');
    if(hdr&&!hdr._dragBound){hdr._dragBound=true;hdr.addEventListener('mousedown',_bmHeaderDown);}
    _bmApplyPos();
  }

  function closeBuildMenu(){
    const bm=$('build-menu-modal');
    if(bm)bm.classList.add('hidden');
    // Reset position so next open re-centers
    _bmPos={left:null,top:null};
    const panel=$('bm-panel');
    if(panel){panel.style.left='';panel.style.top='';panel.style.transform='';}
  }

  function toggleBuildMenu(){
    const bm=$('build-menu-modal');
    if(!bm)return;
    if(bm.classList.contains('hidden'))openBuildMenu();
    else closeBuildMenu();
  }

  function bmTab(tabName){
    // Deactivate all tabs and hide all bodies
    document.querySelectorAll('.bm-tab').forEach(t=>t.classList.remove('bm-tab-active'));
    document.querySelectorAll('.bm-tab-body').forEach(b=>b.classList.add('hidden'));
    // Activate selected tab and show body
    const tab=document.querySelector(`[data-tab="${tabName}"]`);
    const body=$(`bmt-${tabName}`);
    if(tab)tab.classList.add('bm-tab-active');
    if(body)body.classList.remove('hidden');
  }

  function purchaseBuilding(buildingKey){
    const costMap={service_desk:100,problem_mgmt:300,cab:800};
    const cost=costMap[buildingKey]||0;
    if(state.budget<cost){toast(`❌ Potřebuješ ${cost} CZK`);return;}
    state.budget-=cost;
    eventLog(`🏗 ${buildingKey} koupen`,'good');
    toast(`✅ Nákup hotov!`);
    updateUI();
  }

  // ── RESEARCH ───────────────────────────────────────────────────────────────
  function buildResearchPanel(){
    const list=$('research-list');if(!list)return;
    list.innerHTML='';
    for(const[key,r]of Object.entries(RESEARCH)){
      const el=document.createElement('div');
      el.id=`res-${key}`;el.className=`res-item tier-${r.tier}`;
      el.innerHTML=`<div class="res-row"><span class="res-icon">${r.icon}</span><div class="res-text"><span class="res-name">${r.label}</span><span class="res-desc">${r.desc}</span></div><button class="res-btn" onclick="game.research('${key}')">${r.cost}</button></div>`;
      list.appendChild(el);
    }
    renderResearch();
  }

  function renderResearch(){
    for(const[key,r]of Object.entries(RESEARCH)){
      const el=$(`res-${key}`);if(!el)continue;
      const done=state.researched.has(key),locked=r.req.some(k=>!state.researched.has(k));
      el.className=`res-item tier-${r.tier} ${done?'res-done':locked?'res-locked':'res-avail'}`;
      const btn=el.querySelector('.res-btn');
      if(btn){btn.textContent=done?'✓':locked?'🔒':`${r.cost} CZK`;btn.disabled=done||locked;}
    }
    // Hotbar locked state for proc tools
    ['change_board','hana_db'].forEach(k=>{
      const slot=$('hb-'+k.replace(/_/g,'-'));
      if(slot)slot.classList.toggle('hb-locked',!state.unlocked.has(k));
    });
    updateBuildMenu();
  }

  function research(key){
    const r=RESEARCH[key];
    if(!r||state.researched.has(key))return;
    if(r.req.some(k=>!state.researched.has(k))){toast('🔒 Vyžaduje předchozí výzkum!');return;}
    if(state.budget<r.cost){toast(`❌ Potřebuješ ${r.cost} CZK`);return;}
    state.budget-=r.cost;state.researched.add(key);r.apply(state);
    eventLog(`🔬 ${r.label}: ${r.desc}`,'good');
    toast(`✅ ${r.label} dokončen!`);
    renderResearch();updateUI();
  }

  // ── RP MILESTONES ─────────────────────────────────────────────────────────
  const RP_MILESTONES=[
    {rp:50,  key:'change_board', label:'Change Board odemčen! (50 RP)', icon:'📋'},
    {rp:150, key:'belt_express', label:'Express Belt 2× rychlost! (150 RP)', icon:'🚄', apply(s){s.beltPasses=2;}},
    {rp:300, key:'stms',        label:'STMS Router odemčen! (300 RP)', icon:'🚌'},
    {rp:400, key:'hana_db',     label:'HANA DB odemčen! (400 RP)', icon:'🗄'},
    {rp:600, key:'bw_dtp',      label:'BW DTP Processor odemčen! (600 RP)', icon:'📊'},
  ];
  const _rpUnlocked=new Set();

  function checkRpMilestones(){
    const rp=state.rp||0;
    for(const m of RP_MILESTONES){
      if(_rpUnlocked.has(m.key))continue;
      if(rp>=m.rp){
        _rpUnlocked.add(m.key);
        state.unlocked.add(m.key);
        if(m.apply)m.apply(state);
        toast(`${m.icon} Milestone: ${m.label}`,4500);
        eventLog(`🔓 ${m.label}`,'good');
        renderResearch();updateBuildMenu();updateUI();
      }
    }
  }

  // ── RANDOM EVENTS ─────────────────────────────────────────────────────────
  const EVENTS = [
    { w:18, name:'Audit IT Bezpečnosti', icon:'🛡',
      apply(s){ const fine=Math.floor(s.budget*.08+200);s.budget=Math.max(0,s.budget-fine);
        return `Audit zjistil nesoulad! Pokuta ${fine} CZK`; }, cls:'warn' },
    { w:15, name:'Sprint Review Bonus', icon:'🎯',
      apply(s){ const b=Math.floor(200+Math.random()*300*s.globalMult);s.budget+=b;
        return `Sprint Review — PO spokojený! +${b} CZK`; }, cls:'good' },
    { w:12, name:'Výpadek Produkčního Systému', icon:'🔥',
      apply(s){ const lost=Math.min(s.items.length,Math.floor(2+Math.random()*3));
        s.items.splice(0,lost); return `PRD Outage! ${lost} TRek ztraceno`; }, cls:'warn' },
    { w:10, name:'Externí Konzultant SAP', icon:'🤵',
      apply(s){ const b=Math.floor(500+Math.random()*800);s.budget+=b;
        return `Konzultant optimalizoval procesy! +${b} CZK`; }, cls:'good' },
    { w:8,  name:'Zákaznický Escalation', icon:'📞',
      apply(s){ if(s.items.length===0)return null;
        const chg=s.items.filter(i=>i.type==='change');
        if(chg.length>0){chg[0].value=Math.floor(chg[0].value*1.8);return `Zákazník eskaloval! CHG priorita ×1.8`;}
        return `Escalation call — žádné CHG items k urychlení`; }, cls:'warn' },
    { w:8,  name:'Go-Live Bonus', icon:'🚀',
      apply(s){ const bonus=Math.floor(s.totalDeploys*15+100);s.budget+=bonus;
        return `Úspěšný Go-Live! Bonus ${bonus} CZK (${s.totalDeploys} dep)`; }, cls:'good' },
    { w:7,  name:'Change Freeze', icon:'❄',
      apply(s){ const frozen=s.items.filter(i=>i.type==='change').length;
        s.items=s.items.filter(i=>i.type!=='change');
        return frozen>0?`Change Freeze! ${frozen} CHG items zmrazeno`:`Change Freeze — ale žádné CHG items`; }, cls:'warn' },
    { w:6,  name:'SAP Note Oprava', icon:'📝',
      apply(s){ const b=Math.floor(150+Math.random()*200);s.budget+=b;
        return `Kritická SAP Note aplikována! +${b} CZK saved`; }, cls:'good' },
    { w:5,  name:'Hacker Incident', icon:'💀',
      apply(s){ const fine=Math.floor(s.budget*.15+500);s.budget=Math.max(0,s.budget-fine);
        return `Bezpečnostní incident! Nouzová záplata stála ${fine} CZK`; }, cls:'warn' },
    { w:5,  name:'Šéf přijde na návštěvu', icon:'👔',
      apply(s){ s.globalMult=+(s.globalMult*1.05).toFixed(4);
        return `Šéf je impressed! Permanentní +5% payout mult`; }, cls:'good' },
    { w:4,  name:'IDoc Flood', icon:'🌊',
      apply(s){ for(let k=0;k<4;k++){
          const types=['incident','incident','problem'];const tp=types[k%types.length];
          const adj=[{dx:1,dy:0},{dx:0,dy:1},{dx:-1,dy:0},{dx:0,dy:-1}];
          for(const m of s.miners){ for(const a of adj){
            const nx=m.x+a.dx,ny=m.y+a.dy;
            if(!inBounds(nx,ny))continue;
            const nt=s.grid[ny][nx];
            if(BELT_TILES.has(nt)&&!s.items.find(i=>i.x===nx&&i.y===ny)){
              s.items.push({id:s.nextId++,x:nx,y:ny,type:tp,value:REQ[tp].value,stage:0,delay:0,pdx:0,pdy:0});break;
            }
          }}
        } return `IDoc Flood! 4 extra items injektováno do pásů`; }, cls:'good' },
    { w:3,  name:'Datová Katastrofa', icon:'💾',
      apply(s){ const removed=Math.floor(s.items.length/2);
        s.items.splice(0,removed);return `Disk crash! ${removed} TRek nenávratně ztraceno!`; }, cls:'warn' },
    { w:3,  name:'Škoda Management Review', icon:'🏎',
      apply(s){ const b=Math.floor(1000+s.totalDeploys*20);s.budget+=b;
        return `Škoda Board impressed! Jednorázový bonus ${b} CZK`; }, cls:'good' },
  ];

  let _eventTick=0;
  const EVENT_INTERVAL=25; // každých 25 ticků = cca 25 sekund

  function maybeEvent(){
    _eventTick++;
    if(_eventTick<EVENT_INTERVAL)return;
    _eventTick=0;
    // Jen pokud hráč má alespoň 1 minera (aktivní hráč)
    if(state.miners.length===0)return;
    const total=EVENTS.reduce((s,e)=>s+e.w,0);
    let rnd=Math.random()*total;
    let ev=EVENTS[EVENTS.length-1];
    for(const e of EVENTS){rnd-=e.w;if(rnd<=0){ev=e;break;}}
    const msg=ev.apply(state);
    if(msg){
      const banner=$('event-banner');
      banner.textContent=`${ev.icon} ${ev.name}: ${msg}`;
      banner.className=''; // reset classes
      banner.classList.add(ev.cls==='warn'?'event-warn':'event-good');
      banner.classList.remove('hidden');
      clearTimeout(toast._t);
      toast._t=setTimeout(()=>banner.classList.add('hidden'),5000);
      eventLog(`${ev.icon} ${msg}`,ev.cls);
    }
    renderItems();updateUI();
  }

  // ── ACHIEVEMENTS ──────────────────────────────────────────────────────────
  const ACHIEVEMENTS=[
    {id:'first_deploy',  icon:'🚀', label:'First Deploy!',     check:s=>s.totalDeploys>=1},
    {id:'ten_deploys',   icon:'📦', label:'10 deployů!',       check:s=>s.totalDeploys>=10},
    {id:'century',       icon:'💯', label:'100 deployů!',      check:s=>s.totalDeploys>=100},
    {id:'rich',          icon:'💰', label:'Milionář! 1M CZK',  check:s=>s.budget>=1_000_000},
    {id:'miners5',       icon:'⛏⛏', label:'5 minerů!',        check:s=>s.miners.length>=5},
    {id:'researcher',    icon:'🔬', label:'5 výzkumů',         check:s=>s.researched.size>=5},
    {id:'max_research',  icon:'🏆', label:'Všechny výzkumy!',  check:s=>s.researched.size>=Object.keys(RESEARCH).length},
    {id:'hana_first',    icon:'🗄',  label:'HANA deployed!',   check:s=>s.totalDeploys>=1&&s.unlocked.has('hana_db')},
  ];
  const _achieved=new Set();

  function checkAchievements(){
    for(const a of ACHIEVEMENTS){
      if(_achieved.has(a.id))continue;
      if(a.check(state)){
        _achieved.add(a.id);
        showAchievement(a);
      }
    }
  }

  function showAchievement(a){
    const el=document.createElement('div');
    el.className='achievement-toast';
    el.innerHTML=`<span class="ach-icon">${a.icon}</span><div><div class="ach-title">Achievement!</div><div class="ach-label">${a.label}</div></div>`;
    document.body.appendChild(el);
    requestAnimationFrame(()=>requestAnimationFrame(()=>el.classList.add('show')));
    setTimeout(()=>{el.classList.remove('show');setTimeout(()=>el.remove(),400);},3500);
    eventLog(`🏆 Achievement: ${a.label}`,'good');
  }

  // ── GAME TICK ──────────────────────────────────────────────────────────────
  function inBounds(x,y){return x>=0&&x<COLS&&y>=0&&y<ROWS;}
  function free(nx,ny,id){return !state.items.some(i=>i.id!==id&&i.x===nx&&i.y===ny&&i.delay===0);}

  function doMovePass(){
    const grid=state.grid,items=state.items;
    items.sort((a,b)=>(b.x+b.y)-(a.x+a.y));
    const remove=new Set();
    for(const it of items){
      if(remove.has(it.id)||it.delay>0)continue;
      const t=grid[it.y][it.x];
      if(PROC_TILES.has(t)){
        if(!it.pdx&&!it.pdy)continue;
        const nx=it.x+it.pdx,ny=it.y+it.pdy;
        if(!inBounds(nx,ny))continue;
        const nt=grid[ny][nx];
        if(!BELT_TILES.has(nt)&&!PROC_TILES.has(nt)&&nt!==T.output)continue;
        if(!free(nx,ny,it.id))continue;
        it.x=nx;it.y=ny;it.pdx=0;it.pdy=0;continue;
      }
      if(t===T.output){
        const payout=Math.floor(it.value*STAGE_MULT[it.stage]*state.globalMult);
        state.budget+=payout;state.totalDeploys++;state.tickBudget+=payout;
        state.deploysLastMin.push(Date.now());
        eventLog(`🚀 ${REQ[it.type].icon}[${STAGE_LABEL[it.stage]}] +${payout} CZK`,'good');
        remove.add(it.id);flashPRD();continue;
      }
      if(t===T.rnd){
        // R&D Lab: convert item to RP based on stage
        const rpGain=Math.max(1,Math.floor([1,2,4,8,15][it.stage]*(it.type==='change'?2:it.type==='problem'?1.5:1)));
        state.rp=(state.rp||0)+rpGain;
        eventLog(`🔬 ${REQ[it.type].icon}→${rpGain} RP (total: ${state.rp})`,'good');
        remove.add(it.id);
        checkRpMilestones();continue;
      }
      const mv=BELT_MOVE[t];if(!mv)continue;
      const nx=it.x+mv.dx,ny=it.y+mv.dy;
      if(!inBounds(nx,ny))continue;
      const nt=grid[ny][nx];
      if(nt===T.rnd){
        // Route onto R&D Lab
        if(!items.find(i=>i.id!==it.id&&i.x===nx&&i.y===ny)){
          it.x=nx;it.y=ny;it.pdx=mv.dx;it.pdy=mv.dy;
        }
        continue;
      }
      if(PROC_TILES.has(nt)){
        const cfg=PROC_CFG[nt];
        if(cfg&&it.stage===cfg.needStage&&!items.find(i=>i.id!==it.id&&i.x===nx&&i.y===ny)){
          it.x=nx;it.y=ny;it.pdx=mv.dx;it.pdy=mv.dy;it.delay=cfg.ticks;
          if(it.delay===0){it.stage=cfg.outStage;it.pdx=0;it.pdy=0;}
        }
        continue;
      }
      if(!BELT_TILES.has(nt)&&nt!==T.output&&nt!==T.rnd)continue;
      if(!free(nx,ny,it.id))continue;
      it.x=nx;it.y=ny;
    }
    state.items=state.items.filter(i=>!remove.has(i.id));
  }

  function tick(){
    if(state.paused)return;
    state.tickBudget=0;
    for(const m of state.miners){
      if(--m.timer>0)continue;
      m.timer=state.minerInterval;
      const adj=[{x:m.x+1,y:m.y},{x:m.x,y:m.y+1},{x:m.x-1,y:m.y},{x:m.x,y:m.y-1}];
      for(const n of adj){
        if(!inBounds(n.x,n.y))continue;
        const nt=state.grid[n.y][n.x];
        if(!BELT_TILES.has(nt)&&!PROC_TILES.has(nt)&&nt!==T.output&&nt!==T.rnd)continue;
        if(state.items.find(i=>i.x===n.x&&i.y===n.y))continue;
        state.items.push({id:state.nextId++,x:n.x,y:n.y,type:m.type,value:REQ[m.type].value,stage:0,delay:0,pdx:0,pdy:0});
        break;
      }
    }
    for(const it of state.items){
      if(it.delay>0&&--it.delay===0){
        const cfg=PROC_CFG[state.grid[it.y][it.x]];
        if(cfg){it.stage=cfg.outStage;eventLog(`✅ ${REQ[it.type].icon}→${STAGE_LABEL[it.stage]}`,'good');}
      }
    }
    doMovePass();
    if(state.beltPasses>=2)doMovePass();
    maybeEvent();
    checkAchievements();
    renderItems();updateUI();
  }

  function flashPRD(){
    for(let y=0;y<ROWS;y++)for(let x=0;x<COLS;x++)
      if(state.grid[y][x]===T.output){
        cellEls[y][x].classList.add('prd-flash');
        setTimeout(()=>cellEls[y][x].classList.remove('prd-flash'),400);
      }
  }

  // ── UI UPDATE ──────────────────────────────────────────────────────────────
  function updateUI(){
    const s=state;
    const belts=s.grid.flat().filter(t=>BELT_TILES.has(t)).length;
    const procs=s.grid.flat().filter(t=>PROC_TILES.has(t)).length;
    $('stat-budget').textContent=fmt(s.budget)+' CZK';
    $('stat-queue').textContent=s.items.length;
    $('stat-raw').textContent=s.miners.length+' ⛏';
    $('stat-bugs').textContent=belts+'/'+procs;
    $('chip-bugs').querySelector('.stat-label').textContent='Belt/Proc';
    $('chip-bugs').classList.remove('warn');$('chip-bugs').style.cssText='';
    const set=(id,v)=>{const el=$(id);if(el)el.textContent=v;};
    set('m-bps',fmt(s.tickBudget)+' CZK');set('m-deploys',s.totalDeploys);
    set('m-miners',s.miners.length);set('m-procs',procs);
    set('m-items',s.items.length);set('m-mult','×'+s.globalMult.toFixed(2));
    set('m-int',s.minerInterval+'s / '+(s.beltPasses>1?'×2':'×1'));
    // RP display
    const statRp=$('stat-rp');if(statRp)statRp.textContent=(s.rp||0)+' RP';
    // RPM (deploys per minute based on last 60s)
    const now=Date.now();
    s.deploysLastMin=(s.deploysLastMin||[]).filter(t=>now-t<60000);
    set('m-rpm',s.deploysLastMin.length+'/min');
    // Affordability on hotbar
    document.querySelectorAll('.hb-slot[data-cost]').forEach(el=>{
      const cost=parseInt(el.dataset.cost)||0;
      el.classList.toggle('hb-broke',s.budget<cost);
    });
  }

  // ── SAVE / LOAD ────────────────────────────────────────────────────────────
  function saveGame(slot){
    const data={
      v:3,ts:new Date().toLocaleString('cs-CZ'),
      budget:state.budget,totalDeploys:state.totalDeploys,nextId:state.nextId,
      minerInterval:state.minerInterval,globalMult:state.globalMult,beltPasses:state.beltPasses,
      rp:state.rp||0,
      grid:state.grid,items:state.items,miners:state.miners,
      researched:Array.from(state.researched),unlocked:Array.from(state.unlocked),
      procTicks:Object.fromEntries(Object.keys(PROC_DEFAULTS).map(k=>[k,PROC_CFG[T[k]].ticks])),
    };
    localStorage.setItem(`sap_save_${slot}`,JSON.stringify(data));
    renderMenuSlots();
    toast(`💾 Uloženo do Slotu ${slot+1}`);
    eventLog(`💾 Hra uložena – Slot ${slot+1}`,'good');
  }

  function loadGame(slot){
    const raw=localStorage.getItem(`sap_save_${slot}`);
    if(!raw){toast('❌ Slot je prázdný!');return;}
    const d=JSON.parse(raw);
    state.budget=d.budget;state.totalDeploys=d.totalDeploys;state.nextId=d.nextId;
    state.minerInterval=d.minerInterval??3;state.globalMult=d.globalMult??1;
    state.beltPasses=d.beltPasses??1;state.tickBudget=0;state.rp=d.rp||0;
    state.deploysLastMin=[];
    state.grid=d.grid;state.items=d.items;state.miners=d.miners;
    state.researched=new Set(d.researched);state.unlocked=new Set(d.unlocked);
    if(d.procTicks)Object.keys(d.procTicks).forEach(k=>{if(T[k]&&PROC_CFG[T[k]])PROC_CFG[T[k]].ticks=d.procTicks[k];});
    clearItemEls();renderGrid();renderItems();buildResearchPanel();updateUI();
    ['title-overlay','menu-overlay'].forEach(id=>{const el=$(id);if(el){el.classList.add('hidden');el.style.animation='';}});
    state.paused=false;
    toast(`📂 Načten Slot ${slot+1} (${d.ts})`);
    eventLog(`📂 Hra načtena – Slot ${slot+1}`,'good');
  }

  function newGame(){
    if(!confirm('Začít novou hru? Neuložený postup bude ztracen.'))return;
    state.budget=500;state.totalDeploys=0;state.tickBudget=0;
    state.grid=parseMap();state.items=[];state.miners=[];state.nextId=0;
    state.researched=new Set();state.unlocked=new Set(['compiler','qa_gate']);
    state.minerInterval=3;state.globalMult=1.0;state.beltPasses=1;
    Object.keys(PROC_DEFAULTS).forEach(k=>{if(T[k]&&PROC_CFG[T[k]])PROC_CFG[T[k]].ticks=PROC_DEFAULTS[k];});
    clearItemEls();renderGrid();renderItems();buildResearchPanel();updateUI();
    ['title-overlay','menu-overlay'].forEach(id=>{const el=$(id);if(el){el.classList.add('hidden');el.style.animation='';}});
    state.paused=false;
    toast('🔄 Nová hra zahájena!');
  }

  function getSaveInfo(slot){
    const raw=localStorage.getItem(`sap_save_${slot}`);
    if(!raw)return null;
    try{return JSON.parse(raw);}catch{return null;}
  }

  // ── MENU ───────────────────────────────────────────────────────────────────
  function openMenu(){
    state.paused=true;
    const set=(id,v)=>{const el=$(id);if(el)el.textContent=v;};
    set('mi-budget',fmt(state.budget)+' CZK');
    set('mi-deploys',state.totalDeploys+' deployů');
    set('mi-research',state.researched.size+'/13 výzkumů');
    set('mi-miners',state.miners.length+' minerů · '+state.items.length+' items');
    renderMenuSlots();
    $('menu-overlay').classList.remove('hidden');
  }

  function closeMenu(){
    state.paused=false;
    $('menu-overlay').classList.add('hidden');
  }

  function renderMenuSlots(){
    const container=$('save-slots');if(!container)return;
    container.innerHTML='';
    for(let i=0;i<3;i++){
      const d=getSaveInfo(i);
      const div=document.createElement('div');
      div.className='save-slot'+(d?' has-data':'');
      if(d){
        const r=(d.researched||[]).length;
        div.innerHTML=
          `<div class="slot-n">${i+1}</div>`+
          `<div class="slot-info"><span class="slot-budget">${fmt(d.budget)} CZK</span>`+
          `<span class="slot-meta">${d.totalDeploys} dep · ${r}/13 výzk · ${(d.miners||[]).length} ⛏</span>`+
          `<span class="slot-ts">${d.ts||'—'}</span></div>`+
          `<div class="slot-btns"><button class="slot-btn sb-load" onclick="game.loadGame(${i})">📂 Načíst</button>`+
          `<button class="slot-btn sb-save" onclick="game.saveGame(${i})">💾</button></div>`;
      } else {
        div.innerHTML=
          `<div class="slot-n dim">${i+1}</div>`+
          `<div class="slot-info"><span class="slot-empty">— prázdný slot —</span></div>`+
          `<button class="slot-btn sb-save" onclick="game.saveGame(${i})">💾 Uložit</button>`;
      }
      container.appendChild(div);
    }
  }

  // ── TITLE SCREEN ───────────────────────────────────────────────────────────
  function titleNewGame(){
    const el=$('title-overlay');if(!el)return;
    el.style.animation='title-out .38s ease forwards';
    setTimeout(()=>{el.classList.add('hidden');el.style.animation='';state.paused=false;},380);
    toast('🎮 Vítej! Q=Miner · W/A/S/D=Belty · E/R/T/Y=Procesory · B=Katalog');
  }

  function renderTitleSlots(){
    const c=$('title-slots');if(!c)return;
    c.innerHTML='';
    for(let i=0;i<3;i++){
      const d=getSaveInfo(i);
      const div=document.createElement('div');
      div.className='ts'+(d?' ts-full':'');
      if(d){
        const r=(d.researched||[]).length;
        div.innerHTML=
          `<div class="ts-top"><span class="ts-n">Slot ${i+1}</span><span class="ts-time">${d.ts||''}</span></div>`+
          `<div class="ts-budget">${fmt(d.budget)} CZK</div>`+
          `<div class="ts-meta">${d.totalDeploys} dep · ${r}/13 · ${(d.miners||[]).length}⛏</div>`+
          `<button class="ts-btn" onclick="game.loadGame(${i})">📂 Načíst</button>`;
      } else {
        div.innerHTML=`<div class="ts-top"><span class="ts-n dim">Slot ${i+1}</span></div><div class="ts-empty">— prázdný —</div>`;
      }
      c.appendChild(div);
    }
  }

  // ── KEYBOARD ───────────────────────────────────────────────────────────────
  document.addEventListener('keydown', e => {
    if(e.target.tagName==='INPUT'||e.target.tagName==='BUTTON')return;
    // Title screen - ignore all except Enter
    if(!$('title-overlay').classList.contains('hidden')){
      if(e.key==='Enter'||e.key===' ')titleNewGame();
      return;
    }
    // Escape priority: close build menu first, then close pause menu, then open pause menu
    if(e.key==='Escape'){
      if(!$('build-menu-modal').classList.contains('hidden')){closeBuildMenu();return;}
      if(!$('menu-overlay').classList.contains('hidden')){closeMenu();return;}
      openMenu();return;
    }
    // B = build menu
    if(e.key==='b'||e.key==='B'){
      e.preventDefault();toggleBuildMenu();return;
    }
    // 1/2/3 = purchase buildings (when build menu open)
    if(['1','2','3'].includes(e.key)&&!$('build-menu-modal').classList.contains('hidden')){
      const map={'1':'service_desk','2':'problem_mgmt','3':'cab'};
      if(map[e.key])purchaseBuilding(map[e.key]);
      return;
    }
    // Ctrl+S = quick save
    if((e.ctrlKey||e.metaKey)&&e.key==='s'){
      e.preventDefault();saveGame(0);return;
    }
    // Tool shortcuts (only when not paused, not in menu)
    if(state.paused)return;
    const tool=KEY_TOOLS[e.key.toLowerCase()];
    if(tool){
      e.preventDefault();
      selectTool(tool);
      // Close build menu on tool select
      if(!$('build-menu-modal').classList.contains('hidden'))closeBuildMenu();
    }
  });

  // ── THEME ─────────────────────────────────────────────────────────────────
  function toggleTheme(){
    const light=document.body.classList.toggle('light');
    const btn=$('theme-btn');
    if(btn)btn.textContent=light?'🌙 Dark':'☀ Light';
    localStorage.setItem('sap_theme',light?'light':'dark');
  }

  // ── INIT ───────────────────────────────────────────────────────────────────
  function init(){
    // Restore theme
    if(localStorage.getItem('sap_theme')==='light'){
      document.body.classList.add('light');
      const btn=$('theme-btn');if(btn)btn.textContent='🌙 Dark';
    }
    buildGrid();renderGrid();renderItems();buildResearchPanel();updateUI();
    selectTool('miner');
    renderTitleSlots();
    eventLog('🎮 Sestav: ⛏→⚙→✔→📋→🗄→🏭 PRD = ×4.8','good');
    eventLog('⌨ Q=Miner · WASD=Belt · E/R/T/Y=Proc · B=Katalog · Esc=Menu','good');
    setInterval(tick,1000);
  }

  document.addEventListener('DOMContentLoaded',init);
  return { selectTool, research, openMenu, closeMenu, saveGame, loadGame, newGame,
           titleNewGame, toggleBuildMenu, openBuildMenu, closeBuildMenu, bmTab, purchaseBuilding, toggleTheme };
})();
