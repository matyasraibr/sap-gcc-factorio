'use strict';

function toggleSection(el) {
  el.closest('.collapsible').classList.toggle('open');
}

const game = (() => {
  const COLS = 40, ROWS = 20, T_PX = 40;

  const T = {
    empty:'empty', output:'output',
    ore_i:'ore_i',  ore_p:'ore_p',  ore_c:'ore_c',
    min_i:'min_i',  min_p:'min_p',  min_c:'min_c',
    b_r:'b_r', b_l:'b_l', b_d:'b_d', b_u:'b_u',
    compiler:'compiler', qa_gate:'qa_gate',
    change_board:'change_board', hana_db:'hana_db', rnd:'rnd',
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
  const COSTS = { miner:100, belt:5, compiler:150, qa_gate:100, change_board:200, hana_db:350, output:400, rnd:500 };
  const BELT_CYCLE = ['b_r','b_d','b_u','b_l'];
  const HOTKEYS = {'1':'miner','2':'b_r','3':'compiler','4':'qa_gate','5':'change_board','6':'hana_db','x':'delete'};

  const AUTO_BUILD_CFG = {
    service_desk: { oreType:'incident', interval:3, cost:100,  label:'Service Desk',     icon:'🎧', desc:'Auto INC · 3s' },
    problem_mgmt: { oreType:'problem',  interval:5, cost:300,  label:'Problem Mgmt',      icon:'🔧', desc:'Auto PRB · 5s' },
    cab:          { oreType:'change',   interval:8, cost:800,  label:'Change Adv. Board', icon:'📋', desc:'Auto CHG · 8s' },
  };

  // ── RESEARCH TREE ──────────────────────────────────────────────────────────
  const RESEARCH = {
    budget_analyst:  { label:'Budget Analyst',    icon:'💰',  tier:0, desc:'+10% payouts',       cost:250,  req:[],                apply(s){s.globalMult*=1.10} },
    fast_mining:     { label:'Fast Mining',        icon:'⚡',  tier:0, desc:'Mining 3s → 2s',     cost:300,  req:[],                apply(s){s.minerInterval=2} },
    fast_compile:    { label:'Fast Compile',       icon:'⚙',  tier:0, desc:'Compiler 2s → 1s',   cost:400,  req:[],                apply(){PROC_CFG[T.compiler].ticks=1} },
    auto_qa:         { label:'Auto QA',            icon:'🔬', tier:0, desc:'QA Gate instant',     cost:500,  req:[],                apply(){PROC_CFG[T.qa_gate].ticks=0} },
    cost_optimizer:  { label:'Cost Optimizer',     icon:'💰💰',tier:1, desc:'+20% payouts',       cost:600,  req:['budget_analyst'],apply(s){s.globalMult*=1.20} },
    turbo_mining:    { label:'Turbo Mining',       icon:'⚡⚡',tier:1, desc:'Mining 2s → 1s',     cost:800,  req:['fast_mining'],   apply(s){s.minerInterval=1} },
    instant_compile: { label:'Instant Compile',    icon:'⚙⚙', tier:1, desc:'Compiler instant',  cost:1200, req:['fast_compile'],  apply(){PROC_CFG[T.compiler].ticks=0} },
    ai_optimizer:    { label:'SAP AI Optimizer',   icon:'🤖', tier:2, desc:'Values +30%',         cost:2000, req:['instant_compile'],apply(s){s.globalMult*=1.30} },
    cloud_integration:{ label:'Cloud Integration', icon:'☁️', tier:3, desc:'×1.5 all values',    cost:4000, req:['ai_optimizer'], apply(s){s.globalMult*=1.50} },
    devops_pipeline: { label:'DevOps Pipeline',    icon:'🔄', tier:3, desc:'Change Board → 1s',  cost:2500, req:['ai_optimizer'], apply(){PROC_CFG[T.change_board].ticks=1} },
    belt_booster:    { label:'Belt Speed Booster', icon:'🚄⚡',tier:1, desc:'Belts 25% faster',   cost:0,   rpCost:150, req:[], apply(s){s.beltTickMs=750;restartTick(750);} },
    extraction_overclock:{ label:'Extraction Overclock',icon:'⛏⚡',tier:1, desc:'Miners −1s interval', cost:300, rpCost:0, req:[], apply(s){s.minerInterval=Math.max(1,s.minerInterval-1);} },
    ai_inspector:    { label:'AI Quality Inspector',icon:'🤖🔍',tier:2, desc:'QA quality +15%',   cost:0,   rpCost:300, req:['belt_booster'], apply(s){s.globalMult*=1.15;} },
    hana_cloud:      { label:'HANA Cloud Opt.',    icon:'☁⚡', tier:3, desc:'PRD payouts ×1.5',  cost:1000,rpCost:500, req:['ai_inspector'], apply(s){s.hanaCloudMult=1.5;} },
  };

  // RP milestones — auto-unlock when state.rp reaches threshold
  const RP_MILESTONES=[
    {rp:50, key:'m50', label:'Automation I — Change Board',      apply(s){s.unlocked.add('change_board');}},
    {rp:150,key:'m150',label:'Advanced Logistics — Express Belts',apply(s){s.beltPasses=2;}},
    {rp:400,key:'m400',label:'High Performance — HANA DB',        apply(s){s.unlocked.add('hana_db');}},
  ];

  function genMap(){
    const g=Array.from({length:ROWS},()=>Array(COLS).fill(T.empty));
    // No pre-placed PRD station — player places all manually via Build Menu
    // Ore spawns in cols 4..(COLS-3); cols 0-3 = spawn clear
    function ok(x,y){return x>=4&&x<COLS-2&&y>=0&&y<ROWS&&g[y][x]===T.empty;}
    function clump(tile,cx,cy){
      if(!ok(cx,cy))return;
      g[cy][cx]=tile;
      const ds=[{dx:1,dy:0},{dx:-1,dy:0},{dx:0,dy:1},{dx:0,dy:-1},{dx:1,dy:1},{dx:-1,dy:1},{dx:1,dy:-1}];
      ds.sort(()=>Math.random()-.5);
      let n=1,sz=3+Math.floor(Math.random()*4);
      for(const d of ds){if(n>=sz)break;if(ok(cx+d.dx,cy+d.dy)){g[cy+d.dy][cx+d.dx]=tile;n++;}}
    }
    function rand(tile,x0,x1){
      let x,y,t=0;
      do{x=x0+Math.floor(Math.random()*(x1-x0));y=Math.floor(Math.random()*ROWS);t++;}
      while(!ok(x,y)&&t<40);
      clump(tile,x,y);
    }
    rand(T.ore_i,4,12);rand(T.ore_i,8,20);if(Math.random()>.5)rand(T.ore_i,14,26);
    rand(T.ore_p,10,22);rand(T.ore_p,16,30);if(Math.random()>.5)rand(T.ore_p,8,24);
    rand(T.ore_c,18,30);rand(T.ore_c,24,38);
    return g;
  }

  // ── STATE ──────────────────────────────────────────────────────────────────
  const state = {
    budget:1000, totalDeploys:0, tickBudget:0,
    grid:genMap(), items:[], miners:[],
    tool:'miner', nextId:0, rp:0,
    researched:new Set(), unlocked:new Set(['compiler','qa_gate']),
    rpMilestonesHit:new Set(),
    minerInterval:3, globalMult:1.0, beltPasses:1, beltTickMs:1000, hanaCloudMult:1.0,
    paused:true,
    autoBuildings:{ service_desk:0, problem_mgmt:0, cab:0 },
    abTimers:     { service_desk:3, problem_mgmt:5, cab:8 },
    buildMenuOpen:false,
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
    if (cls) p.className=cls;
    p.textContent=msg; el.prepend(p);
    while (el.children.length>60) el.lastChild.remove();
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

  const TILE_ICON={[T.min_i]:'⛏',[T.min_p]:'⛏',[T.min_c]:'⛏',[T.b_r]:'',[T.b_l]:'',[T.b_d]:'',[T.b_u]:'',
    [T.output]:'🏭',[T.compiler]:'⚙',[T.qa_gate]:'✔',[T.change_board]:'📋',[T.hana_db]:'🗄',[T.rnd]:'🔬'};

  function renderGrid() {
    for (let y=0;y<ROWS;y++) for (let x=0;x<COLS;x++) {
      const t=state.grid[y][x],el=cellEls[y][x];
      el.className=`gc t-${t}`;
      // Processor tiles get a progress-bar child; others use plain textContent
      if(PROC_TILES.has(t)){
        el.innerHTML=`${TILE_ICON[t]??''}<span class="proc-bar"></span>`;
      } else {
        el.textContent=TILE_ICON[t]??'';
      }
    }
  }

  function renderProcessors(){
    // Build lookup of items currently being processed (delay>0 on a proc tile)
    const active=new Map();
    for(const it of state.items){
      if(it.delay>0&&PROC_TILES.has(state.grid[it.y]?.[it.x]))
        active.set(it.y*COLS+it.x, it);
    }
    for(let y=0;y<ROWS;y++)for(let x=0;x<COLS;x++){
      if(!PROC_TILES.has(state.grid[y][x]))continue;
      const el=cellEls[y][x];
      const bar=el.querySelector('.proc-bar');
      if(!bar)continue;
      const it=active.get(y*COLS+x);
      if(it){
        const mt=PROC_CFG[state.grid[y][x]]?.ticks||1;
        bar.style.transform=`scaleX(${mt>0?((mt-it.delay)/mt).toFixed(3):1})`;
        bar.className=`proc-bar pb-${it.type}`;
        el.classList.add('proc-active');
      } else {
        bar.style.transform='scaleX(0)';
        bar.className='proc-bar';
        el.classList.remove('proc-active');
      }
    }
  }

  function clearItemEls() {
    Object.values(itemEls).forEach(el=>el.parentNode&&el.remove());
    Object.keys(itemEls).forEach(k=>delete itemEls[k]);
  }

  function iLabel(it){ return it.delay>0?'⚙':STAGE_LABEL[it.stage]; }
  function iCls(it){
    const sc=STAGE_CLS[it.stage]??'';
    return `world-item ${REQ[it.type].cls}${sc?' '+sc:''}${it.delay>0?' proc':''}`;
  }

  function renderItems() {
    const live=new Set(state.items.map(i=>i.id));
    for (const it of state.items) {
      const lx=it.x*T_PX+T_PX/2-12,ly=it.y*T_PX+T_PX/2-12;
      const lbl=iLabel(it),cls=iCls(it);
      if (!itemEls[it.id]) {
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
  function onCell(x,y) {
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
    if(tool==='output'||tool==='rnd'){
      if(t!==T.empty){toast('Musí být prázdné pole!');return;}
      if(state.budget<COSTS[tool]){toast(`❌ Potřebuješ ${COSTS[tool]} CZK`);return;}
      state.budget-=COSTS[tool];state.grid[y][x]=T[tool];
      eventLog(`🏗 ${tool==='output'?'PRD Station':'R&D Lab'} (${x},${y})`,'good');
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
  }

  // ── TOOL SELECT ────────────────────────────────────────────────────────────
  const BELT_ICONS = {b_r:'▶',b_l:'◀',b_d:'▼',b_u:'▲'};
  const BELT_DIRS  = {b_r:'→',b_l:'←',b_d:'↓',b_u:'↑'};

  function selectTool(tool){
    state.tool=tool;

    // Hotbar: activate matching slot (belt slot activates for any belt)
    document.querySelectorAll('.hb-slot').forEach(el=>{
      el.classList.toggle('hb-active',
        el.dataset.tool===tool || (el.dataset.tool==='belt' && BELT_TILES.has(tool)));
    });
    // Belt slot: update icon + direction label
    if(BELT_TILES.has(tool)){
      const ic=$('hb-belt-icon'); if(ic) ic.textContent=BELT_ICONS[tool];
      const dc=$('hb-belt-dir');  if(dc) dc.textContent=BELT_DIRS[tool]+' · W↻';
      HOTKEYS['2']=tool;
    }
    // Hotbar locked state for proc buildings
    ['change_board','hana_db'].forEach(k=>{
      const locked=!state.unlocked.has(k);
      const s=$('hb-'+k.replace(/_/g,'-'));
      if(s){s.classList.toggle('hb-locked',locked);const c=s.querySelector('.hb-cost');if(c)c.textContent=locked?'🔒':`${COSTS[k]}`;}
    });
    // Build menu highlight
    document.querySelectorAll('[data-tool]').forEach(el=>{
      el.classList.toggle('bm-active', el.dataset.tool===tool);
    });
    // Backwards compat: old .tool-btn (no-op if removed)
    document.querySelectorAll('.tool-btn').forEach(b=>b.classList.remove('active'));
    const ob=$('t-'+tool.replace(/_/g,'-'));if(ob)ob.classList.add('active');

    const locked=PROC_TILES.has(T[tool])&&!state.unlocked.has(tool);
    const hints={
      miner:`⛏ Klikni na ore patch · každé ${state.minerInterval}s · 100 CZK  [Q]`,
      b_r:'▶ Belt doprava · 5 CZK  [D / →]',
      b_l:'◀ Belt doleva · 5 CZK  [A / ←]',
      b_d:'▼ Belt dolů · 5 CZK  [S / ↓]',
      b_u:'▲ Belt nahoru · 5 CZK  [W / ↑]',
      compiler:`⚙ ABAP Compiler · RAW→TR · ${PROC_CFG[T.compiler].ticks}s · ×1.5 · 150 CZK  [E]`,
      qa_gate:`✔ QA Gate · TR→QA✓ · ${PROC_CFG[T.qa_gate].ticks}s · ×2.1 · 100 CZK  [R]`,
      change_board:locked?'📋 Change Board · 🔒 50 RP nutné [T]':`📋 Change Board · QA✓→CR✓ · ×3.2 · 200 CZK  [T]`,
      hana_db:locked?'🗄 HANA DB · 🔒 400 RP nutné [Y]':`🗄 HANA DB · CR✓→HANA · ×4.8 · 350 CZK  [Y]`,
      output:'🏭 PRD Station · Prodej TRek za CZK · 400 CZK  [P]',
      rnd:'🔬 R&D Lab · TR → Research Points (RP) · 500 CZK  [L]',
      delete:'❌ Delete · Smaže budovu nebo belt  [X]',
    };
    $('tool-hint').textContent=hints[tool]??'';
  }

  function cycleBelt(){
    const idx=BELT_CYCLE.indexOf(state.tool);
    selectTool(BELT_CYCLE[idx>=0?(idx+1)%BELT_CYCLE.length:0]);
  }

  // ── RESEARCH ───────────────────────────────────────────────────────────────
  function buildResearchPanel(){
    const list=$('research-list');if(!list)return;
    list.innerHTML='';
    for(const[key,r]of Object.entries(RESEARCH)){
      const el=document.createElement('div');
      el.id=`res-${key}`;el.className=`res-item tier-${r.tier}`;
      const cLbl=r.rpCost?`${r.rpCost} RP${r.cost?'+'+r.cost:''}`:`${r.cost} CZK`;
      el.innerHTML=`<div class="res-row"><span class="res-icon">${r.icon}</span><div class="res-text"><span class="res-name">${r.label}</span><span class="res-desc">${r.desc}</span></div><button class="res-btn" onclick="game.research('${key}')">${cLbl}</button></div>`;
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
      const cLbl2=r.rpCost?`${r.rpCost} RP${r.cost?'+'+r.cost:''}`:`${r.cost} CZK`;
      if(btn){btn.textContent=done?'✓':locked?'🔒':cLbl2;btn.disabled=done||locked;}
    }
    ['change_board','hana_db'].forEach(k=>{
      const btn=$('t-'+k.replace(/_/g,'-'));if(!btn)return;
      const locked=!state.unlocked.has(k);
      if(btn.querySelector('small'))btn.querySelector('small').textContent=locked?'🔒 Research':`${COSTS[k]} CZK`;
      btn.classList.toggle('tool-locked',locked);
    });
    // Update hotbar + build menu
    ['change_board','hana_db'].forEach(k=>{
      const locked=!state.unlocked.has(k);
      const hbs=$('hb-'+k.replace(/_/g,'-'));
      if(hbs){hbs.classList.toggle('hb-locked',locked);const c=hbs.querySelector('.hb-cost');if(c)c.textContent=locked?'🔒':`${COSTS[k]}`;}
      const bmi=$('bm-'+k.replace(/_/g,'-'));
      if(bmi){bmi.classList.toggle('bm-locked',locked);const lc=bmi.querySelector('.bm-lock-cost');if(lc)lc.textContent=locked?'🔒 Research':`${COSTS[k]} CZK`;}
    });
    const bo=$('build-overlay');if(bo&&!bo.classList.contains('hidden'))updateBuildMenuState();
  }

  function research(key){
    const r=RESEARCH[key];
    if(!r||state.researched.has(key))return;
    if(r.req.some(k=>!state.researched.has(k))){toast('🔒 Vyžaduje předchozí výzkum!');return;}
    const rpCost=r.rpCost??0;
    if(rpCost>0&&state.rp<rpCost){toast(`❌ Potřebuješ ${rpCost} RP`);return;}
    if((r.cost??0)>0&&state.budget<r.cost){toast(`❌ Potřebuješ ${r.cost} CZK`);return;}
    state.budget-=(r.cost??0);if(rpCost>0)state.rp-=rpCost;
    state.researched.add(key);r.apply(state);
    eventLog(`🔬 ${r.label}: ${r.desc}`,'good');
    toast(`✅ ${r.label} dokončen!`);
    renderResearch();updateUI();
  }

  // ── MILESTONES ─────────────────────────────────────────────────────────────
  function checkMilestones(){
    for(const m of RP_MILESTONES){
      if(!state.rpMilestonesHit.has(m.key)&&state.rp>=m.rp){
        state.rpMilestonesHit.add(m.key);m.apply(state);
        eventLog(`🏆 ${m.label} (${m.rp} RP)`,'good');
        toast(`🏆 ${m.label}`);
        renderResearch();selectTool(state.tool);
      }
    }
  }

  // ── GAME TICK ──────────────────────────────────────────────────────────────
  function inBounds(x,y){return x>=0&&x<COLS&&y>=0&&y<ROWS;}
  function free(nx,ny,id){return !state.items.some(i=>i.id!==id&&i.x===nx&&i.y===ny&&i.delay===0);}

  function doMovePass(){
    const grid=state.grid,items=state.items;
    const remove=new Set();

    // Sort so items CLOSEST TO THEIR DESTINATION move first — clears path for items behind.
    // Axis chosen per item based on the belt it's sitting on:
    //   moving right (+dx): high x first  |  moving left (-dx): low x first
    //   moving down  (+dy): high y first  |  moving up   (-dy): low y first
    items.sort((a,b)=>{
      const ma=BELT_MOVE[grid[a.y]?.[a.x]]??{dx:0,dy:0};
      const mb=BELT_MOVE[grid[b.y]?.[b.x]]??{dx:0,dy:0};
      const sa=ma.dx!==0?(ma.dx>0?a.x:-a.x):(ma.dy>0?a.y:-a.y);
      const sb=mb.dx!==0?(mb.dx>0?b.x:-b.x):(mb.dy>0?b.y:-b.y);
      return sb-sa;
    });

    for(const it of items){
      if(remove.has(it.id)||it.delay>0)continue;
      const t=grid[it.y][it.x];
      if(PROC_TILES.has(t)){
        if(!it.pdx&&!it.pdy)continue;
        const nx=it.x+it.pdx,ny=it.y+it.pdy;
        if(!inBounds(nx,ny))continue;
        const nt=grid[ny][nx];
        if(!BELT_TILES.has(nt)&&!PROC_TILES.has(nt)&&nt!==T.output&&nt!==T.rnd)continue;
        if(!free(nx,ny,it.id))continue;
        it.x=nx;it.y=ny;it.pdx=0;it.pdy=0;continue;
      }
      if(t===T.output){
        const payout=Math.floor(it.value*STAGE_MULT[it.stage]*state.globalMult*state.hanaCloudMult);
        state.budget+=payout;state.totalDeploys++;state.tickBudget+=payout;
        eventLog(`🚀 ${REQ[it.type].icon}[${STAGE_LABEL[it.stage]}] +${payout} CZK`,'good');
        remove.add(it.id);flashPRD();continue;
      }
      if(t===T.rnd){
        const rp=Math.ceil((it.stage+1)*REQ[it.type].value/50);
        state.rp+=rp;
        eventLog(`🔬 +${rp} RP [${STAGE_LABEL[it.stage]}]`,'good');
        remove.add(it.id);continue;
      }
      const mv=BELT_MOVE[t];if(!mv)continue;
      const nx=it.x+mv.dx,ny=it.y+mv.dy;
      if(!inBounds(nx,ny))continue;
      const nt=grid[ny][nx];
      if(PROC_TILES.has(nt)){
        const cfg=PROC_CFG[nt];
        if(cfg&&it.stage===cfg.needStage&&!items.find(i=>i.id!==it.id&&i.x===nx&&i.y===ny)){
          it.x=nx;it.y=ny;it.pdx=mv.dx;it.pdy=mv.dy;it.delay=cfg.ticks;
          // For instant processors (ticks=0) keep pdx/pdy so exit logic fires next pass
          if(it.delay===0)it.stage=cfg.outStage;
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
    for(const[key,cfg]of Object.entries(AUTO_BUILD_CFG)){
      if(!state.autoBuildings[key])continue;
      if(--state.abTimers[key]<=0){state.abTimers[key]=cfg.interval;spawnAutoItem(cfg.oreType);}
    }
    for(const it of state.items){
      if(it.delay>0&&--it.delay===0){
        const cfg=PROC_CFG[state.grid[it.y][it.x]];
        if(cfg){it.stage=cfg.outStage;eventLog(`✅ ${REQ[it.type].icon}→${STAGE_LABEL[it.stage]}`,'good');}
      }
    }
    doMovePass();
    if(state.beltPasses>=2)doMovePass();
    checkMilestones();
    renderItems();renderProcessors();updateUI();
  }

  function flashPRD(){
    for(let y=0;y<ROWS;y++)for(let x=0;x<COLS;x++)
      if(state.grid[y][x]===T.output){
        cellEls[y][x].classList.add('prd-flash');
        setTimeout(()=>cellEls[y][x].classList.remove('prd-flash'),400);
      }
  }

  // ── AUTO-BUILD ─────────────────────────────────────────────────────────────
  function spawnAutoItem(oreType) {
    const belts=[];
    for(let y=0;y<ROWS;y++)for(let x=0;x<COLS;x++)
      if(BELT_TILES.has(state.grid[y][x])&&!state.items.find(i=>i.x===x&&i.y===y))
        belts.push({x,y});
    if(!belts.length)return;
    const p=belts[Math.floor(Math.random()*belts.length)];
    state.items.push({id:state.nextId++,x:p.x,y:p.y,type:oreType,value:REQ[oreType].value,stage:0,delay:0,pdx:0,pdy:0});
  }

  function purchaseBuilding(key) {
    const cfg=AUTO_BUILD_CFG[key];if(!cfg)return;
    if(state.budget<cfg.cost){toast(`❌ Need ${cfg.cost} CZK`);return;}
    state.budget-=cfg.cost;state.autoBuildings[key]++;
    const n=state.autoBuildings[key];
    eventLog(`🏗 ${cfg.icon} ${cfg.label} #${n} active`,'good');
    toast(`✅ ${cfg.label} #${n} online!`);
    renderBuildMenu();updateUI();
  }

  function bmTab(name){
    document.querySelectorAll('.bm-tab').forEach(t=>t.classList.toggle('bm-tab-active',t.dataset.tab===name));
    document.querySelectorAll('.bm-tab-body').forEach(b=>b.classList.toggle('hidden',b.id!=='bmt-'+name));
  }

  function openBuildMenu(){
    state.buildMenuOpen=true;
    $('build-menu-modal').classList.remove('hidden');
    bmTab('production');
    renderBuildMenu();
  }
  function closeBuildMenu(){
    state.buildMenuOpen=false;
    $('build-menu-modal').classList.add('hidden');
    // Reset panel to CSS-centered position for next open
    const p=$('bm-panel');
    if(p){p.style.left='';p.style.top='';p.style.transform='';}
  }
  function toggleBuildMenu(){ state.buildMenuOpen?closeBuildMenu():openBuildMenu(); }

  function initBMDrag(){
    const panel=$('bm-panel'),header=$('bm-header');
    if(!panel||!header)return;
    let drag=false,ox=0,oy=0;
    header.addEventListener('mousedown',e=>{
      e.preventDefault();drag=true;
      const r=panel.getBoundingClientRect();
      ox=e.clientX-r.left;oy=e.clientY-r.top;
      header.style.cursor='grabbing';
    });
    document.addEventListener('mousemove',e=>{
      if(!drag)return;
      const x=Math.max(0,Math.min(window.innerWidth-panel.offsetWidth,e.clientX-ox));
      const y=Math.max(0,Math.min(window.innerHeight-panel.offsetHeight,e.clientY-oy));
      panel.style.left=x+'px';panel.style.top=y+'px';panel.style.transform='none';
    });
    document.addEventListener('mouseup',()=>{drag=false;header.style.cursor='grab';});
  }

  function renderBuildMenu(){
    // Dim every costed item when budget is insufficient; locked items stay locked regardless
    document.querySelectorAll('#bm-panel .bm-item[data-cost]').forEach(el=>{
      if(el.classList.contains('bm-locked'))return;
      el.classList.toggle('bm-dim', +el.dataset.cost>0 && state.budget<+el.dataset.cost);
    });
    // Auto-building counts
    for(const[key,cfg]of Object.entries(AUTO_BUILD_CFG)){
      const k=key.replace(/_/g,'-');
      const cn=$('bmc-'+k);
      if(cn)cn.textContent=state.autoBuildings[key]?`×${state.autoBuildings[key]}`:'';
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
    const rpe=$('stat-rp');if(rpe)rpe.textContent=s.rp+' RP';
    $('chip-bugs').querySelector('.stat-label').textContent='Belt/Proc';
    $('chip-bugs').classList.remove('warn');$('chip-bugs').style.cssText='';
    const set=(id,v)=>{const el=$(id);if(el)el.textContent=v;};
    set('m-bps',fmt(s.tickBudget)+' CZK');set('m-deploys',s.totalDeploys);
    set('m-miners',s.miners.length);set('m-procs',procs);
    set('m-items',s.items.length);set('m-mult','×'+s.globalMult.toFixed(2));
    set('m-int',s.minerInterval+'s / '+(s.beltPasses>1?'×2':'×1'));
    if(s.buildMenuOpen)renderBuildMenu();
  }

  // ── SAVE / LOAD ────────────────────────────────────────────────────────────
  function saveGame(slot){
    const data={
      v:2, ts:new Date().toLocaleString('cs-CZ'),
      budget:state.budget, totalDeploys:state.totalDeploys, nextId:state.nextId,
      minerInterval:state.minerInterval, globalMult:state.globalMult, beltPasses:state.beltPasses,
      grid:state.grid, items:state.items, miners:state.miners,
      researched:Array.from(state.researched), unlocked:Array.from(state.unlocked),
      procTicks:Object.fromEntries(Object.keys(PROC_DEFAULTS).map(k=>[k,PROC_CFG[T[k]].ticks])),
      autoBuildings:{...state.autoBuildings}, abTimers:{...state.abTimers},
      rp:state.rp, rpMilestonesHit:Array.from(state.rpMilestonesHit),
      beltTickMs:state.beltTickMs, hanaCloudMult:state.hanaCloudMult,
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
    state.beltPasses=d.beltPasses??1;state.tickBudget=0;
    state.grid=d.grid;state.items=d.items;state.miners=d.miners;
    state.researched=new Set(d.researched);state.unlocked=new Set(d.unlocked);
    if(d.procTicks) Object.keys(d.procTicks).forEach(k=>{ if(T[k]&&PROC_CFG[T[k]]) PROC_CFG[T[k]].ticks=d.procTicks[k]; });
    state.autoBuildings=d.autoBuildings??{ service_desk:0, problem_mgmt:0, cab:0 };
    state.abTimers=d.abTimers??{ service_desk:3, problem_mgmt:5, cab:8 };
    state.rp=d.rp??0;state.rpMilestonesHit=new Set(d.rpMilestonesHit??[]);
    state.beltTickMs=d.beltTickMs??1000;state.hanaCloudMult=d.hanaCloudMult??1.0;
    restartTick(state.beltTickMs);
    clearItemEls();renderGrid();renderItems();buildResearchPanel();updateUI();
    // close whichever overlay is open (title or pause menu)
    ['title-overlay','menu-overlay'].forEach(id=>{const el=$(id);if(el){el.classList.add('hidden');el.style.animation='';}});
    state.paused=false;
    toast(`📂 Načten Slot ${slot+1} (${d.ts})`);
    eventLog(`📂 Hra načtena – Slot ${slot+1}`,'good');
  }

  function newGame(){
    if(!confirm('Začít novou hru? Neuložený postup bude ztracen.'))return;
    state.budget=1000;state.totalDeploys=0;state.tickBudget=0;
    state.grid=genMap();state.items=[];state.miners=[];state.nextId=0;
    state.researched=new Set();state.unlocked=new Set(['compiler','qa_gate']);
    state.rp=0;state.rpMilestonesHit=new Set();
    state.beltTickMs=1000;state.hanaCloudMult=1.0;restartTick(1000);
    state.minerInterval=3;state.globalMult=1.0;state.beltPasses=1;
    state.autoBuildings={ service_desk:0, problem_mgmt:0, cab:0 };
    state.abTimers={ service_desk:3, problem_mgmt:5, cab:8 };
    Object.keys(PROC_DEFAULTS).forEach(k=>{ if(T[k]&&PROC_CFG[T[k]]) PROC_CFG[T[k]].ticks=PROC_DEFAULTS[k]; });
    clearItemEls();renderGrid();renderItems();buildResearchPanel();updateUI();
    closeMenu();toast('🔄 Nová hra zahájena!');
  }

  function getSaveInfo(slot){
    const raw=localStorage.getItem(`sap_save_${slot}`);
    if(!raw)return null;
    try{ return JSON.parse(raw); }catch{ return null; }
  }

  // ── MENU ───────────────────────────────────────────────────────────────────
  function openMenu(){
    state.paused=true;
    // Update game info panel
    const set=(id,v)=>{const el=$(id);if(el)el.textContent=v;};
    set('mi-budget', fmt(state.budget)+' CZK');
    set('mi-deploys',state.totalDeploys+' deployů');
    set('mi-research',state.researched.size+'/14 výzkumů · '+state.rp+' RP');
    set('mi-miners',  state.miners.length+' minerů · '+state.items.length+' items');
    renderMenuSlots();
    const ov=$('menu-overlay');
    ov.classList.remove('hidden');
    ov.classList.add('menu-open');
  }

  function closeMenu(){
    state.paused=false;
    $('menu-overlay').classList.add('hidden');
    $('menu-overlay').classList.remove('menu-open');
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
          `<div class="slot-info">`+
            `<span class="slot-budget">${fmt(d.budget)} CZK</span>`+
            `<span class="slot-meta">${d.totalDeploys} dep · ${r}/13 výzk · ${(d.miners||[]).length} ⛏</span>`+
            `<span class="slot-ts">${d.ts||'—'}</span>`+
          `</div>`+
          `<div class="slot-btns">`+
            `<button class="slot-btn sb-load" onclick="game.loadGame(${i})">📂 Načíst</button>`+
            `<button class="slot-btn sb-save" onclick="game.saveGame(${i})">💾</button>`+
          `</div>`;
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
    const el=$('title-overlay'); if(!el)return;
    el.style.animation='title-out .38s ease forwards';
    setTimeout(()=>{el.classList.add('hidden');el.style.animation='';state.paused=false;},380);
    toast('🎮 Vítej v SAP GCC Factorio! Postav první Miner na ore patch.');
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
          `<div class="ts-meta">${d.totalDeploys} dep · ${r}/13 výzk · ${(d.miners||[]).length}⛏</div>`+
          `<button class="ts-btn" onclick="game.loadGame(${i})">📂 Načíst</button>`;
      } else {
        div.innerHTML=`<div class="ts-top"><span class="ts-n dim">Slot ${i+1}</span></div><div class="ts-empty">— prázdný —</div>`;
      }
      c.appendChild(div);
    }
  }

  // ── KEYBOARD ───────────────────────────────────────────────────────────────
  document.addEventListener('keydown', e => {
    if(!$('title-overlay').classList.contains('hidden'))return;
    if(e.key==='Escape'){
      if(state.buildMenuOpen){closeBuildMenu();return;}
      if($('menu-overlay').classList.contains('hidden'))openMenu();
      else closeMenu();
      return;
    }
    if((e.ctrlKey||e.metaKey)&&e.key==='s'){
      e.preventDefault();saveGame(0);if(state.paused)renderMenuSlots();return;
    }
    if(state.paused)return;
    const k=e.key.toLowerCase();
    if(k==='b'){toggleBuildMenu();return;}
    if(k==='1'){purchaseBuilding('service_desk');return;}
    if(k==='2'){purchaseBuilding('problem_mgmt');return;}
    if(k==='3'){purchaseBuilding('cab');return;}
    // Belt directions — WASD and arrow keys
    if(k==='w'||k==='arrowup'){e.preventDefault();selectTool('b_u');return;}
    if(k==='d'||k==='arrowright'){e.preventDefault();selectTool('b_r');return;}
    if(k==='s'||k==='arrowdown'){e.preventDefault();selectTool('b_d');return;}
    if(k==='a'||k==='arrowleft'){e.preventDefault();selectTool('b_l');return;}
    if(k==='q'){selectTool('miner');return;}
    if(k==='e'){selectTool('compiler');return;}
    if(k==='r'){selectTool('qa_gate');return;}
    if(k==='t'){selectTool('change_board');return;}
    if(k==='y'){selectTool('hana_db');return;}
    if(k==='p'){selectTool('output');return;}
    if(k==='l'){selectTool('rnd');return;}
    if(k==='x'){selectTool('delete');return;}
  });

  // ── TICK MANAGEMENT ────────────────────────────────────────────────────────
  let _tickHandle=null;
  function restartTick(ms){
    if(_tickHandle)clearInterval(_tickHandle);
    _tickHandle=setInterval(tick,ms||1000);
  }

  function toggleTheme(){
    const light=document.body.classList.toggle('light');
    const btn=$('theme-btn');if(btn)btn.textContent=light?'🌙 Dark':'☀ Light';
  }

  // ── INIT ───────────────────────────────────────────────────────────────────
  function init(){
    buildGrid();renderGrid();renderItems();buildResearchPanel();updateUI();
    selectTool('miner');
    initBMDrag();
    renderTitleSlots();
    eventLog('🎮 Sestav: ⛏→⚙→✔→📋→🗄→🏭 PRD = ×4.8 · Postav PRD Station!','good');
    eventLog('💡 B=Catalogue · Esc=menu · Ctrl+S=save · P=PRD · L=R&D','good');
    restartTick(state.beltTickMs);
  }

  document.addEventListener('DOMContentLoaded',init);
  return { selectTool, cycleBelt, bmTab, toggleTheme, research, openMenu, closeMenu, saveGame, loadGame, newGame, titleNewGame,
           purchaseBuilding, openBuildMenu, closeBuildMenu, toggleBuildMenu };
})();
