'use strict';

function toggleSection(el) {
  el.closest('.collapsible').classList.toggle('open');
}

const game = (() => {
  const COLS = 60, ROWS = 30, T_PX = 40;

  const T = {
    empty:'empty', output:'output',
    ore_i:'ore_i',  ore_p:'ore_p',  ore_c:'ore_c',
    min_i:'min_i',  min_p:'min_p',  min_c:'min_c',
    // Generic belts
    b_r:'b_r', b_l:'b_l', b_d:'b_d', b_u:'b_u',
    // INC-only belts (blue)
    bi_r:'bi_r', bi_l:'bi_l', bi_d:'bi_d', bi_u:'bi_u',
    // PRB-only belts (orange)
    bp_r:'bp_r', bp_l:'bp_l', bp_d:'bp_d', bp_u:'bp_u',
    // CHG-only belts (purple)
    bc_r:'bc_r', bc_l:'bc_l', bc_d:'bc_d', bc_u:'bc_u',
    compiler:'compiler', qa_gate:'qa_gate',
    change_board:'change_board', hana_db:'hana_db', rnd:'rnd',
    sm36:'sm36', stms:'stms', oss:'oss', bw_dtp:'bw_dtp',
    splitter:'splitter',
    inc_triage:'inc_triage', inc_resolver:'inc_resolver', inc_closer:'inc_closer',
    prb_analyst:'prb_analyst', prb_rootcause:'prb_rootcause', prb_change:'prb_change',
    chg_impact:'chg_impact', chg_cab:'chg_cab', chg_deploy:'chg_deploy',
  };

  const ORE_TILES  = new Set([T.ore_i, T.ore_p, T.ore_c]);
  const MIN_TILES  = new Set([T.min_i, T.min_p, T.min_c]);
  const BELT_TILES = new Set([T.b_r, T.b_l, T.b_d, T.b_u,
    T.bi_r,T.bi_l,T.bi_d,T.bi_u,
    T.bp_r,T.bp_l,T.bp_d,T.bp_u,
    T.bc_r,T.bc_l,T.bc_d,T.bc_u]);
  // Which ore types a coloured belt accepts (null = all)
  const BELT_ORE = {
    bi_r:'incident',bi_l:'incident',bi_d:'incident',bi_u:'incident',
    bp_r:'problem', bp_l:'problem', bp_d:'problem', bp_u:'problem',
    bc_r:'change',  bc_l:'change',  bc_d:'change',  bc_u:'change',
  };
  const PROC_TILES = new Set([T.compiler, T.qa_gate, T.change_board, T.hana_db, T.sm36, T.stms, T.oss, T.bw_dtp,
    T.inc_triage, T.inc_resolver, T.inc_closer,
    T.prb_analyst, T.prb_rootcause, T.prb_change,
    T.chg_impact, T.chg_cab, T.chg_deploy]);
  const BELT_MOVE  = {
    b_r:{dx:1,dy:0},  b_l:{dx:-1,dy:0}, b_d:{dx:0,dy:1},  b_u:{dx:0,dy:-1},
    bi_r:{dx:1,dy:0}, bi_l:{dx:-1,dy:0},bi_d:{dx:0,dy:1},  bi_u:{dx:0,dy:-1},
    bp_r:{dx:1,dy:0}, bp_l:{dx:-1,dy:0},bp_d:{dx:0,dy:1},  bp_u:{dx:0,dy:-1},
    bc_r:{dx:1,dy:0}, bc_l:{dx:-1,dy:0},bc_d:{dx:0,dy:1},  bc_u:{dx:0,dy:-1},
  };

  const ORE_TO_MIN = { ore_i:'min_i', ore_p:'min_p', ore_c:'min_c' };
  const MIN_TO_ORE = { min_i:'ore_i', min_p:'ore_p', min_c:'ore_c' };
  const ORE_TYPE   = { ore_i:'incident', ore_p:'problem', ore_c:'change',
                       min_i:'incident', min_p:'problem', min_c:'change' };

  const STAGE_MULT  = [1.0, 1.5, 2.1, 3.2, 4.8];
  const STAGE_LABEL = ['RAW','TR','QA✓','CR✓','HANA'];
  const STAGE_CLS   = ['','s-tr','s-qa','s-cr','s-hana'];

  const REQ = {
    incident: { value:100, icon:'INC', cls:'item-inc' },
    problem:  { value:300, icon:'PRB', cls:'item-prb' },
    change:   { value:800, icon:'CHG', cls:'item-chg' },
  };

  const PROC_CFG = {
    [T.compiler]:     { needStage:0, ticks:2, outStage:1 },
    [T.qa_gate]:      { needStage:1, ticks:1, outStage:2 },
    [T.change_board]: { needStage:2, ticks:3, outStage:3 },
    [T.hana_db]:      { needStage:3, ticks:2, outStage:4 },
    // BC/BW ore-type-specific pipeline shortcuts — forces dedicated lanes per ore
    // SM36: INC-only shortcut RAW(0)→QA✓(2), saves Compiler+QA Gate
    [T.sm36]:   { needStage:0, oreTypes:['incident'], ticks:2, outStage:2 },
    // STMS: PRB-only shortcut TR(1)→CR✓(3), saves QA+Change Board (needs Compiler first)
    [T.stms]:   { needStage:1, oreTypes:['problem'],  ticks:3, outStage:3 },
    // OSS: INC+PRB value booster any stage ×1.4, rejects CHG
    [T.oss]:    { needStage:-1, oreTypes:['incident','problem'], ticks:1, outStage:-1, valueMult:1.4 },
    // BW DTP: universal booster for QA✓(2)+ stages, ×1.8
    [T.bw_dtp]: { needStage:2, ticks:3, outStage:-1, valueMult:1.8 },
    // Ore-specific pipeline buildings
    [T.inc_triage]:   { needStage:0, oreTypes:['incident'], ticks:1, outStage:1 },
    [T.inc_resolver]: { needStage:1, oreTypes:['incident'], ticks:2, outStage:2 },
    [T.inc_closer]:   { needStage:2, oreTypes:['incident'], ticks:1, outStage:3 },
    [T.prb_analyst]:  { needStage:0, oreTypes:['problem'],  ticks:2, outStage:1 },
    [T.prb_rootcause]:{ needStage:1, oreTypes:['problem'],  ticks:3, outStage:2 },
    [T.prb_change]:   { needStage:2, oreTypes:['problem'],  ticks:2, outStage:3 },
    [T.chg_impact]:   { needStage:0, oreTypes:['change'],   ticks:3, outStage:1 },
    [T.chg_cab]:      { needStage:1, oreTypes:['change'],   ticks:4, outStage:3 },
    [T.chg_deploy]:   { needStage:3, oreTypes:['change'],   ticks:2, outStage:4 },
  };

  const PROC_DEFAULTS = { compiler:2, qa_gate:1, change_board:3, hana_db:2, sm36:2, stms:3, oss:1, bw_dtp:3,
    inc_triage:1, inc_resolver:2, inc_closer:1, prb_analyst:2, prb_rootcause:3, prb_change:2, chg_impact:3, chg_cab:4, chg_deploy:2 };
  const COSTS = { miner:150, belt:8, belt_i:12, belt_p:20, belt_c:35,
    compiler:300, qa_gate:200, change_board:500, hana_db:800, output:400, rnd:600, sm36:200, stms:300, oss:280, bw_dtp:500, splitter:60,
    inc_triage:150, inc_resolver:300, inc_closer:600, prb_analyst:400, prb_rootcause:800, prb_change:1200, chg_impact:800, chg_cab:1500, chg_deploy:2500 };
  const BELT_CYCLE = ['b_r','b_d','b_u','b_l'];
  const HOTKEYS = {'1':'miner','2':'b_r','3':'compiler','4':'qa_gate','5':'change_board','6':'hana_db','x':'delete'};

  const AUTO_BUILD_CFG = {
    service_desk: { oreType:'incident', interval:3, cost:100,  label:'Service Desk',     icon:'🎧', desc:'Auto INC · 3s' },
    problem_mgmt: { oreType:'problem',  interval:5, cost:300,  label:'Problem Mgmt',      icon:'🔧', desc:'Auto PRB · 5s' },
    cab:          { oreType:'change',   interval:8, cost:800,  label:'Change Adv. Board', icon:'📋', desc:'Auto CHG · 8s' },
  };

  // ── RESEARCH TREE ──────────────────────────────────────────────────────────
  const RESEARCH = {
    budget_analyst:  { label:'Budget Analyst',    icon:'💰',  tier:0, desc:'+10% payouts',       cost:400,  req:[],                apply(s){s.globalMult*=1.10} },
    fast_mining:     { label:'Fast Mining',        icon:'⚡',  tier:0, desc:'Mining 3s → 2s',     cost:500,  req:[],                apply(s){s.minerInterval=2} },
    fast_compile:    { label:'Fast Compile',       icon:'⚙',  tier:0, desc:'Compiler 2s → 1s',   cost:600,  req:[],                apply(){PROC_CFG[T.compiler].ticks=1} },
    auto_qa:         { label:'Auto QA',            icon:'🔬', tier:0, desc:'QA Gate instant',     cost:800,  req:[],                apply(){PROC_CFG[T.qa_gate].ticks=0} },
    cost_optimizer:  { label:'Cost Optimizer',     icon:'💰💰',tier:1, desc:'+20% payouts',       cost:1000, req:['budget_analyst'],apply(s){s.globalMult*=1.20} },
    turbo_mining:    { label:'Turbo Mining',       icon:'⚡⚡',tier:1, desc:'Mining 2s → 1s',     cost:1200, req:['fast_mining'],   apply(s){s.minerInterval=1} },
    instant_compile: { label:'Instant Compile',    icon:'⚙⚙', tier:1, desc:'Compiler instant',  cost:1800, req:['fast_compile'],  apply(){PROC_CFG[T.compiler].ticks=0} },
    ai_optimizer:    { label:'SAP AI Optimizer',   icon:'🤖', tier:2, desc:'Values +30%',         cost:3000, req:['instant_compile'],apply(s){s.globalMult*=1.30} },
    cloud_integration:{ label:'Cloud Integration', icon:'☁️', tier:3, desc:'×1.5 all values',    cost:6000, req:['ai_optimizer'], apply(s){s.globalMult*=1.50} },
    devops_pipeline: { label:'DevOps Pipeline',    icon:'🔄', tier:3, desc:'Change Board → 1s',  cost:4000, req:['ai_optimizer'], apply(){PROC_CFG[T.change_board].ticks=1} },
    belt_booster:    { label:'Belt Speed Booster', icon:'🚄⚡',tier:1, desc:'Belts 25% faster',   cost:0,   rpCost:200, req:[], apply(s){s.beltTickMs=750;restartTick(750);} },
    extraction_overclock:{ label:'Extraction Overclock',icon:'⛏⚡',tier:1, desc:'Miners −1s interval', cost:500, rpCost:0, req:[], apply(s){s.minerInterval=Math.max(1,s.minerInterval-1);} },
    ai_inspector:    { label:'AI Quality Inspector',icon:'🤖🔍',tier:2, desc:'QA quality +15%',   cost:0,   rpCost:400, req:['belt_booster'], apply(s){s.globalMult*=1.15;} },
    hana_cloud:      { label:'HANA Cloud Opt.',    icon:'☁⚡', tier:3, desc:'PRD payouts ×1.5',  cost:1500,rpCost:600, req:['ai_inspector'], apply(s){s.hanaCloudMult=1.5;} },
  };

  // RP milestones — auto-unlock when state.rp reaches threshold
  const RP_MILESTONES=[
    {rp:5,  key:'m5',   label:'INC Resolver odemčen',              apply(s){s.unlocked.add('inc_resolver');}},
    {rp:20, key:'m20',  label:'PRB Root Cause + CHG Impact',        apply(s){s.unlocked.add('prb_rootcause');s.unlocked.add('chg_impact');}},
    {rp:50, key:'m50',  label:'Change Board + INC Closer',          apply(s){s.unlocked.add('change_board');s.unlocked.add('inc_closer');}},
    {rp:100,key:'m100', label:'PRB→Change + CHG CAB',               apply(s){s.unlocked.add('prb_change');s.unlocked.add('chg_cab');}},
    {rp:150,key:'m150', label:'Express Belts + STMS',               apply(s){s.beltPasses=2;s.unlocked.add('stms');}},
    {rp:300,key:'m300', label:'BW DTP + CHG Emergency Deploy',      apply(s){s.unlocked.add('bw_dtp');s.unlocked.add('chg_deploy');}},
    {rp:400,key:'m400', label:'HANA DB',                            apply(s){s.unlocked.add('hana_db');}},
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
    // INC — levá část mapy
    rand(T.ore_i,4,15);rand(T.ore_i,10,22);rand(T.ore_i,16,28);
    if(Math.random()>.4)rand(T.ore_i,5,18);
    // PRB — střed
    rand(T.ore_p,18,32);rand(T.ore_p,25,40);rand(T.ore_p,14,30);
    if(Math.random()>.4)rand(T.ore_p,22,38);
    // CHG — pravá část mapy (nejcennější, nejdál)
    rand(T.ore_c,35,50);rand(T.ore_c,42,56);rand(T.ore_c,30,48);
    if(Math.random()>.4)rand(T.ore_c,38,54);
    return g;
  }

  // ── STATE ──────────────────────────────────────────────────────────────────
  const state = {
    budget:800, totalDeploys:0, tickBudget:0,
    grid:genMap(), items:[], miners:[],
    tool:'miner', nextId:0, rp:0,
    researched:new Set(), unlocked:new Set(['compiler','qa_gate','sm36','oss','inc_triage','prb_analyst']),
    rpMilestonesHit:new Set(),
    minerInterval:3, globalMult:1.0, beltPasses:1, beltTickMs:1000, hanaCloudMult:1.0,
    splitterCtrs:{}, rpmHistory:new Array(60).fill(0), rpmTick:0,
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
      d.addEventListener('mouseenter',()=>showTileTip(x,y,d));
      d.addEventListener('mouseleave',hideTileTip);
      g.appendChild(d); return d;
    }));
  }

  const TILE_ICON={
    [T.min_i]:'⛏',[T.min_p]:'⛏',[T.min_c]:'⛏',
    [T.b_r]:'',[T.b_l]:'',[T.b_d]:'',[T.b_u]:'',
    [T.bi_r]:'',[T.bi_l]:'',[T.bi_d]:'',[T.bi_u]:'',
    [T.bp_r]:'',[T.bp_l]:'',[T.bp_d]:'',[T.bp_u]:'',
    [T.bc_r]:'',[T.bc_l]:'',[T.bc_d]:'',[T.bc_u]:'',
    [T.output]:'🏭',[T.compiler]:'⚙',[T.qa_gate]:'✔',[T.change_board]:'📋',[T.hana_db]:'🗄',[T.rnd]:'🔬',
    [T.sm36]:'⏱',[T.stms]:'🚌',[T.oss]:'📝',[T.bw_dtp]:'📊',[T.splitter]:'⊕',
    [T.inc_triage]:'🔵',[T.inc_resolver]:'🔄',[T.inc_closer]:'✅',
    [T.prb_analyst]:'🔶',[T.prb_rootcause]:'🔍',[T.prb_change]:'🔀',
    [T.chg_impact]:'🔮',[T.chg_cab]:'📋',[T.chg_deploy]:'🚀',
  };

  // ── HOVER TOOLTIPS ─────────────────────────────────────────────────────────
  const ORE_LABEL = { incident:'INC', problem:'PRB', change:'CHG' };
  const PROC_NAME = {
    [T.compiler]:'ABAP Compiler', [T.qa_gate]:'QA Gate', [T.change_board]:'Change Board', [T.hana_db]:'HANA DB',
    [T.sm36]:'SM36 Scheduler', [T.stms]:'STMS Router', [T.oss]:'OSS Note Scanner', [T.bw_dtp]:'BW DTP Processor',
    [T.inc_triage]:'INC Triage', [T.inc_resolver]:'INC Resolver', [T.inc_closer]:'INC Auto-Closer',
    [T.prb_analyst]:'PRB Analyst', [T.prb_rootcause]:'Root Cause Analysis', [T.prb_change]:'PRB→Change Converter',
    [T.chg_impact]:'CHG Impact Analyzer', [T.chg_cab]:'CHG CAB Review', [T.chg_deploy]:'CHG Emergency Deploy',
  };
  const TT_ARROW = t => ({[T.b_r]:'→',[T.b_l]:'←',[T.b_d]:'↓',[T.b_u]:'↑',
    [T.bi_r]:'→',[T.bi_l]:'←',[T.bi_d]:'↓',[T.bi_u]:'↑',
    [T.bp_r]:'→',[T.bp_l]:'←',[T.bp_d]:'↓',[T.bp_u]:'↑',
    [T.bc_r]:'→',[T.bc_l]:'←',[T.bc_d]:'↓',[T.bc_u]:'↑'}[t]||'▶');

  function tileInfo(t){
    if(!t||t===T.empty) return null;
    if(ORE_TILES.has(t)){
      const ot=ORE_TYPE[t];
      return { icon:'◆', cls:ot, name:`${ORE_LABEL[ot]} ložisko`,
               desc:`Postav sem Miner (Q) · base ${REQ[ot].value} CZK` };
    }
    if(MIN_TILES.has(t)){
      const ot=ORE_TYPE[t], s=(state.minerInterval||3);
      return { icon:'⛏', cls:ot, name:`Miner — ${ORE_LABEL[ot]}`,
               desc:`Těží ${ORE_LABEL[ot]} každé ${s}s · vkládá na sousední belt` };
    }
    if(BELT_TILES.has(t)){
      const arr=TT_ARROW(t), ore=BELT_ORE[t];
      return { icon:arr, cls:ore||'', name:`${ore?ORE_LABEL[ore]+' ':''}Belt ${arr}`,
               desc: ore?`Posune jen ${ORE_LABEL[ore]} items směrem ${arr}`
                        :`Posune items směrem ${arr}` };
    }
    if(t===T.splitter) return { icon:'⊕', cls:'', name:'Splitter', desc:'Round-robin rozdělí tok do volných sousedních beltů' };
    if(t===T.output)   return { icon:'🏭', cls:'', name:'PRD Deploy Station', desc:'Prodá hotový ticket → přičte hodnotu do Budgetu' };
    if(t===T.rnd)      return { icon:'🔬', cls:'', name:'R&D Lab', desc:'Místo prodeje mění items na Research Points (RP)' };
    if(PROC_TILES.has(t)){
      const cfg=PROC_CFG[t], nm=PROC_NAME[t]||t;
      const secs=Math.round((cfg.ticks*(state.beltTickMs||1000))/1000);
      const time=cfg.ticks<=0?'instant':`~${secs}s`;
      let line;
      if(cfg.outStage>=0 && cfg.needStage>=0)
        line=`${STAGE_LABEL[cfg.needStage]} → ${STAGE_LABEL[cfg.outStage]} · hodnota ×${STAGE_MULT[cfg.outStage]}`;
      else if(cfg.valueMult)
        line=`hodnota ×${cfg.valueMult}`+(cfg.needStage>=0?` · od ${STAGE_LABEL[cfg.needStage]} výš`:'');
      else line='zpracování';
      const restr=cfg.oreTypes?` · jen ${cfg.oreTypes.map(o=>ORE_LABEL[o]).join('+')}`:'';
      return { icon:TILE_ICON[t]||'⚙', cls:'', name:nm, desc:`${line} · ${time}${restr}` };
    }
    return null;
  }

  function showTileTip(x,y,cell){
    const tip=$('tile-tooltip'); if(!tip) return;
    const info=tileInfo(state.grid[y]?.[x]);
    if(!info){ tip.classList.add('hidden'); return; }
    tip.innerHTML=`<div class="tt-name${info.cls?' tt-'+info.cls:''}"><span class="tt-icon">${info.icon}</span>${info.name}</div>`+
                  `<div class="tt-desc">${info.desc}</div>`;
    tip.classList.remove('hidden');
    const r=cell.getBoundingClientRect(), tw=tip.offsetWidth, th=tip.offsetHeight, m=8;
    let left=Math.min(Math.max(m, r.left+r.width/2-tw/2), innerWidth-tw-m);
    let top=r.top-th-8;
    if(top<m) top=r.bottom+8;
    tip.style.left=left+'px';
    tip.style.top=top+'px';
  }
  function hideTileTip(){ const tip=$('tile-tooltip'); if(tip) tip.classList.add('hidden'); }

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

  // item stall tracking: id → {x,y,ticks}
  const _itemStall={};

  function renderItems() {
    const live=new Set(state.items.map(i=>i.id));
    const now=Date.now();
    for (const it of state.items) {
      const lx=it.x*T_PX+T_PX/2-12,ly=it.y*T_PX+T_PX/2-12;
      const lbl=iLabel(it),cls=iCls(it);
      // stall tracking
      const st=_itemStall[it.id];
      if(!st||st.x!==it.x||st.y!==it.y){
        _itemStall[it.id]={x:it.x,y:it.y,since:now};
      }
      const stalled=it.delay===0&&(_itemStall[it.id]?.since??now)<now-3000;

      if (!itemEls[it.id]) {
        const el=document.createElement('div');
        el.textContent=lbl;el.className=cls+(stalled?' item-clog':'');
        $('game-grid').appendChild(el);
        itemEls[it.id]=el;
        el.style.transition='none';
        el.style.left=lx+'px';el.style.top=ly+'px';
        requestAnimationFrame(()=>requestAnimationFrame(()=>{el.style.transition='';}));
      } else {
        const el=itemEls[it.id];
        if(el.textContent!==lbl)el.textContent=lbl;
        const wantCls=cls+(stalled?' item-clog':'');
        if(el.className!==wantCls)el.className=wantCls;
        el.style.left=lx+'px';el.style.top=ly+'px';
      }
    }
    // cleanup stall records for removed items
    for(const id in _itemStall){if(!live.has(+id))delete _itemStall[id];}
    for(const id in itemEls){if(!live.has(+id)){itemEls[id].remove();delete itemEls[id];}}
    // clog alert
    const clogCount=state.items.filter(it=>it.delay===0&&(_itemStall[it.id]?.since??now)<now-3000).length;
    const clogEl=$('clog-alert');
    if(clogEl)clogEl.classList.toggle('hidden',clogCount===0);
    if(clogCount>0){const ce=$('clog-count');if(ce)ce.textContent=clogCount;}
    // flash clogged belt cells
    for(let y=0;y<ROWS;y++)for(let x=0;x<COLS;x++){
      if(!BELT_TILES.has(state.grid[y][x]))continue;
      const here=state.items.find(it=>it.x===x&&it.y===y&&it.delay===0&&(_itemStall[it.id]?.since??now)<now-3000);
      cellEls[y][x].classList.toggle('cell-clog',!!here);
    }
  }

  // ── CELL CLICK ─────────────────────────────────────────────────────────────
  function onCell(x,y) {
    if(state.paused)return;
    const tool=state.tool,t=state.grid[y][x];
    if(tool==='delete'){
      if(MIN_TILES.has(t)){state.miners=state.miners.filter(m=>!(m.x===x&&m.y===y));state.grid[y][x]=MIN_TO_ORE[t];}
      else if(BELT_TILES.has(t)||PROC_TILES.has(t)||t===T.output||t===T.rnd||t===T.splitter)state.grid[y][x]=T.empty;
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
      if(!state.unlocked.has(tool)){toast('🔒 Odemkni výzkumem / RP!');return;}
      if(t!==T.empty){toast('Musí být prázdné pole!');return;}
      if(state.budget<COSTS[tool]){toast(`❌ Potřebuješ ${COSTS[tool]} CZK`);return;}
      state.budget-=COSTS[tool];state.grid[y][x]=T[tool];
      const n={compiler:'ABAP Compiler',qa_gate:'QA Gate',change_board:'Change Board',hana_db:'HANA DB',
               sm36:'SM36 Scheduler',stms:'STMS Router',oss:'OSS Scanner',bw_dtp:'BW DTP',
               inc_triage:'INC Triage',inc_resolver:'INC Resolver',inc_closer:'INC Auto-Closer',
               prb_analyst:'PRB Analyst',prb_rootcause:'Root Cause Analysis',prb_change:'PRB→Change',
               chg_impact:'CHG Impact',chg_cab:'CHG CAB Review',chg_deploy:'CHG Emergency Deploy'};
      eventLog(`🏗 ${n[tool]||tool} (${x},${y})`,'good');
      renderGrid();updateUI();return;
    }
    if(BELT_TILES.has(tool)){
      if(t!==T.empty){toast('Belt jen na prázdné pole!');return;}
      if(tool==='b_r'||tool==='b_l'||tool==='b_d'||tool==='b_u'){toast('Použij ore-specifický belt (Tab = přepnutí modu)');return;}
      const beltCost=tool.startsWith('bi')?COSTS.belt_i:tool.startsWith('bp')?COSTS.belt_p:tool.startsWith('bc')?COSTS.belt_c:COSTS.belt;
      if(state.budget<beltCost){toast(`❌ Potřebuješ ${beltCost} CZK`);return;}
      state.budget-=beltCost;state.grid[y][x]=tool;
      renderGrid();updateUI();return;
    }
    if(tool==='splitter'){
      if(t!==T.empty){toast('Musí být prázdné pole!');return;}
      if(state.budget<COSTS.splitter){toast(`❌ Potřebuješ ${COSTS.splitter} CZK`);return;}
      state.budget-=COSTS.splitter;state.grid[y][x]=T.splitter;
      eventLog(`🏗 Splitter (${x},${y})`,'good');
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
    // Hotbar locked state — update via data-tool selectors
    ['change_board','hana_db','stms','bw_dtp','inc_resolver','inc_closer','prb_rootcause','prb_change','chg_impact','chg_cab','chg_deploy'].forEach(k=>{
      const locked=!state.unlocked.has(k);
      document.querySelectorAll(`.hb-slot[data-tool="${k}"]`).forEach(s=>s.classList.toggle('hb-locked',locked));
    });
    // Build menu highlight
    document.querySelectorAll('#bm-panel [data-tool]').forEach(el=>{
      el.classList.toggle('bm-active', el.dataset.tool===tool);
    });

    const locked=PROC_TILES.has(T[tool])&&!state.unlocked.has(tool);
    const hints={
      miner:`⛏ Klikni na ore patch · každé ${state.minerInterval}s · 150 CZK  [Q]`,
      b_r:'▶',b_l:'◀',b_d:'▼',b_u:'▲',
      bi_r:'🔵▶ INC Belt → · 12 CZK  [D]', bi_l:'🔵◀ INC Belt ← · 12 CZK  [A]',
      bi_d:'🔵▼ INC Belt ↓ · 12 CZK  [S]', bi_u:'🔵▲ INC Belt ↑ · 12 CZK  [W]',
      bp_r:'🟠▶ PRB Belt → · 20 CZK  [D]', bp_l:'🟠◀ PRB Belt ← · 20 CZK  [A]',
      bp_d:'🟠▼ PRB Belt ↓ · 20 CZK  [S]', bp_u:'🟠▲ PRB Belt ↑ · 20 CZK  [W]',
      bc_r:'🟣▶ CHG Belt → · 35 CZK  [D]', bc_l:'🟣◀ CHG Belt ← · 35 CZK  [A]',
      bc_d:'🟣▼ CHG Belt ↓ · 35 CZK  [S]', bc_u:'🟣▲ CHG Belt ↑ · 35 CZK  [W]',
      compiler:`⚙ ABAP Compiler · RAW→TR · ${PROC_CFG[T.compiler].ticks}s · ×1.5 · 300 CZK  [E]`,
      qa_gate:`✔ QA Gate · TR→QA✓ · ${PROC_CFG[T.qa_gate].ticks}s · ×2.1 · 200 CZK  [R]`,
      change_board:locked?'📋 Change Board · 🔒 50 RP nutné [T]':`📋 Change Board · QA✓→CR✓ · ×3.2 · 500 CZK  [T]`,
      hana_db:locked?'🗄 HANA DB · 🔒 400 RP nutné [Y]':`🗄 HANA DB · CR✓→HANA · ×4.8 · 800 CZK  [Y]`,
      output:'🏭 PRD Station · Prodej TRek za CZK · 400 CZK  [P]',
      rnd:'🔬 R&D Lab · TR → Research Points (RP) · 600 CZK  [L]',
      sm36:'⏱ SM36 Scheduler · INC RAW→QA✓ shortcut · 200 CZK  [Z]',
      stms:'🚌 STMS Router · PRB TR→CR✓ shortcut · 300 CZK  [U]',
      oss:'📝 OSS Scanner · INC+PRB value ×1.4 · CHG odmítá · 280 CZK  [I]',
      bw_dtp:'📊 BW DTP · QA✓+ stage ×1.8 · 500 CZK  [O]',
      splitter:'⊕ Splitter · Rozděluje items round-robin na 2+ výstupy · 60 CZK  [F]',
      delete:'❌ Delete · Smaže budovu nebo belt  [X]',
      inc_triage:'🔵 INC Triage · INC RAW→TR · 1s · 150 CZK  [G]',
      inc_resolver:state.unlocked.has('inc_resolver')?'🔄 INC Resolver · INC TR→QA✓ · 2s · 300 CZK  [H]':'🔄 INC Resolver · 🔒 5 RP nutné  [H]',
      inc_closer:state.unlocked.has('inc_closer')?'✅ INC Auto-Closer · INC QA✓→CR✓ · 1s · 600 CZK  [J]':'✅ INC Auto-Closer · 🔒 50 RP nutné  [J]',
      prb_analyst:'🔶 PRB Analyst · PRB RAW→TR · 2s · 400 CZK  [N]',
      prb_rootcause:state.unlocked.has('prb_rootcause')?'🔍 Root Cause Analysis · PRB TR→QA✓ · 3s · 800 CZK  [M]':'🔍 Root Cause Analysis · 🔒 20 RP nutné  [M]',
      prb_change:state.unlocked.has('prb_change')?'🔀 PRB→Change Converter · PRB QA✓→CR✓ · 2s · 1200 CZK  [,]':'🔀 PRB→Change · 🔒 100 RP nutné  [,]',
      chg_impact:state.unlocked.has('chg_impact')?'🔮 CHG Impact Analyzer · CHG RAW→TR · 3s · 800 CZK  [V]':'🔮 CHG Impact · 🔒 20 RP nutné  [V]',
      chg_cab:state.unlocked.has('chg_cab')?'📋 CHG CAB Review · CHG TR→CR✓ · 4s · 1500 CZK  [K]':'📋 CHG CAB · 🔒 100 RP nutné  [K]',
      chg_deploy:state.unlocked.has('chg_deploy')?'🚀 CHG Emergency Deploy · CHG CR✓→HANA · 2s · 2500 CZK  [;]':'🚀 CHG Emergency Deploy · 🔒 300 RP nutné  [;]',
    };
    $('tool-hint').textContent=hints[tool]??'';
  }

  function cycleBelt(){
    const idx=BELT_CYCLE.indexOf(state.tool);
    selectTool(BELT_CYCLE[idx>=0?(idx+1)%BELT_CYCLE.length:0]);
  }

  // ── RESEARCH ───────────────────────────────────────────────────────────────
  function buildResearchPanel(){ renderResearch(); }

  function renderResearch(){
    const avail=$('res-available'),locked=$('res-locked-list');
    if(!avail||!locked)return;
    avail.innerHTML='';locked.innerHTML='';
    let lockedCount=0;
    for(const[key,r]of Object.entries(RESEARCH)){
      const done=state.researched.has(key);
      const isLocked=r.req.some(k=>!state.researched.has(k));
      const cLbl=r.rpCost?`${r.rpCost} RP${r.cost?'+'+r.cost:''}`:`${r.cost} CZK`;
      const el=document.createElement('div');
      el.id=`res-${key}`;
      if(done){
        el.className='res-item res-done';
        el.innerHTML=`<div class="res-row"><span class="res-icon">${r.icon}</span><div class="res-text"><span class="res-name">${r.label}</span><span class="res-desc">${r.desc}</span></div><span class="res-done-badge">✓</span></div>`;
        avail.appendChild(el);
      } else if(!isLocked){
        el.className='res-item res-avail';
        el.innerHTML=`<div class="res-row"><span class="res-icon">${r.icon}</span><div class="res-text"><span class="res-name">${r.label}</span><span class="res-desc">${r.desc}</span></div><button class="res-btn" onclick="game.research('${key}')">${cLbl}</button></div>`;
        avail.appendChild(el);
      } else {
        el.className='res-item res-locked-item';
        el.innerHTML=`<div class="res-row"><span class="res-icon" style="opacity:.4">${r.icon}</span><div class="res-text"><span class="res-name" style="opacity:.5">${r.label}</span><span class="res-desc" style="opacity:.4">${r.desc}</span></div><span class="res-lock-badge">🔒 ${cLbl}</span></div>`;
        locked.appendChild(el);
        lockedCount++;
      }
    }
    // update locked accordion label
    const lh=$('res-locked-head');
    if(lh)lh.textContent=`🔒 Zamčené (${lockedCount})`;
    // update build menu locked state
    ['change_board','hana_db','stms','bw_dtp',
     'inc_resolver','inc_closer','prb_rootcause','prb_change','chg_impact','chg_cab','chg_deploy'].forEach(k=>{
      const isLk=!state.unlocked.has(k);
      const bmi=$('bm-'+k.replace(/_/g,'-'));
      if(bmi){bmi.classList.toggle('bm-locked',isLk);const lc=bmi.querySelector('.bm-lock-cost');if(lc)lc.textContent=isLk?'🔒 RP needed':`${COSTS[k]} CZK`;}
      document.querySelectorAll(`.hb-slot[data-tool="${k}"]`).forEach(s=>s.classList.toggle('hb-locked',isLk));
    });
    if(state.buildMenuOpen)renderBuildMenu();
  }

  // ── HOTBAR TOGGLE ──────────────────────────────────────────────────────────
  function toggleHotbar(){
    const wrap=$('hotbar-wrap');if(!wrap)return;
    wrap.classList.toggle('hb-wrap-hidden');
    const btn=$('hb-toggle-btn');
    if(btn)btn.textContent=wrap.classList.contains('hb-wrap-hidden')?'▲':'▼';
  }

  // ── BELT MODE ─────────────────────────────────────────────────────────────
  // Tracks which ore-type belt WASD currently places: generic | inc | prb | chg
  const BELT_MODES = ['inc','prb','chg'];
  const BELT_MODE_PREFIX = { inc:'bi', prb:'bp', chg:'bc' };
  const BELT_MODE_LABEL  = { inc:'🔵 INC', prb:'🟠 PRB', chg:'🟣 CHG' };
  const BELT_MODE_CLS    = { inc:'hb-inc', prb:'hb-prb', chg:'hb-chg' };
  let _beltMode = 'inc';

  function setBeltMode(mode){
    _beltMode=mode;
    const pfx=BELT_MODE_PREFIX[mode];
    // Update the 4 belt hotbar slots to point at the right tool
    const map={w:'u',d:'r',s:'d',a:'l'};
    for(const[key,dir]of Object.entries(map)){
      const slot=$(`hb-belt-${key}`);
      if(!slot)continue;
      const tool=`${pfx}_${dir}`;
      slot.dataset.tool=tool;
      slot.onclick=()=>game.selectTool(tool);
      // re-colour slot
      slot.className='hb-slot'+(BELT_MODE_CLS[mode]?' '+BELT_MODE_CLS[mode]:'');
      if(state.tool===tool||(state.tool.startsWith(pfx+'_')&&state.tool.endsWith('_'+dir)))
        slot.classList.add('hb-active');
    }
    // Update mode bar buttons
    document.querySelectorAll('.bm-btn').forEach(b=>b.classList.remove('bm-active'));
    const active=$(`bmb-${mode}`);if(active)active.classList.add('bm-active');
    // If currently placing a belt, switch to same direction in new mode
    if(BELT_TILES.has(state.tool)){
      const dir=state.tool.slice(-1); // r/l/d/u
      const newTool=`${pfx}_${dir}`;
      if(T[newTool])selectTool(newTool);
    }
    toast(`Belt mode: ${BELT_MODE_LABEL[mode]} (Tab přepne)`);
  }

  function cycleBeltMode(){
    const idx=BELT_MODES.indexOf(_beltMode);
    setBeltMode(BELT_MODES[(idx+1)%BELT_MODES.length]);
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
        if(!BELT_TILES.has(nt)&&!PROC_TILES.has(nt)&&nt!==T.output&&nt!==T.rnd&&nt!==T.splitter)continue;
        if(!free(nx,ny,it.id))continue;
        it.x=nx;it.y=ny;it.pdx=0;it.pdy=0;continue;
      }
      if(t===T.output){
        const payout=Math.floor(it.value*STAGE_MULT[it.stage]*state.globalMult*state.hanaCloudMult);
        state.budget+=payout;state.totalDeploys++;state.tickBudget+=payout;
        state.rpmHistory[state.rpmTick]++;
        eventLog(`🚀 ${REQ[it.type].icon}[${STAGE_LABEL[it.stage]}] +${payout} CZK`,'good');
        remove.add(it.id);flashPRD();continue;
      }
      if(t===T.rnd){
        const rp=Math.ceil((it.stage+1)*REQ[it.type].value/50);
        state.rp+=rp;
        eventLog(`🔬 +${rp} RP [${STAGE_LABEL[it.stage]}]`,'good');
        remove.add(it.id);continue;
      }
      // Splitter: round-robin route to adjacent valid tiles
      if(t===T.splitter){
        const dirs=[{dx:1,dy:0},{dx:-1,dy:0},{dx:0,dy:1},{dx:0,dy:-1}];
        const outs=dirs.filter(d=>{
          const ox=it.x+d.dx,oy=it.y+d.dy;
          if(!inBounds(ox,oy))return false;
          const ot=grid[oy][ox];
          return BELT_TILES.has(ot)||PROC_TILES.has(ot)||ot===T.output||ot===T.rnd;
        });
        if(outs.length){
          const k=it.y*COLS+it.x;
          const idx=(state.splitterCtrs[k]||0)%outs.length;
          state.splitterCtrs[k]=(state.splitterCtrs[k]||0)+1;
          const d=outs[idx];
          const ox=it.x+d.dx,oy=it.y+d.dy;
          if(free(ox,oy,it.id)){it.x=ox;it.y=oy;}
        }
        continue;
      }
      const mv=BELT_MOVE[t];if(!mv)continue;
      const nx=it.x+mv.dx,ny=it.y+mv.dy;
      if(!inBounds(nx,ny))continue;
      const nt=grid[ny][nx];
      if(PROC_TILES.has(nt)){
        const cfg=PROC_CFG[nt];
        if(cfg){
          const stageOk=cfg.needStage<0||it.stage===cfg.needStage;
          const typeOk=!cfg.oreTypes||cfg.oreTypes.includes(it.type);
          if(stageOk&&typeOk&&!items.find(i=>i.id!==it.id&&i.x===nx&&i.y===ny)){
            it.x=nx;it.y=ny;it.pdx=mv.dx;it.pdy=mv.dy;it.delay=cfg.ticks;
            if(it.delay===0){
              if(cfg.outStage>=0)it.stage=cfg.outStage;
              if(cfg.valueMult!=null)it.value=Math.round(it.value*cfg.valueMult);
            }
          }
        }
        continue;
      }
      // Splitter: item enters, will be routed next pass
      if(nt===T.splitter){if(free(nx,ny,it.id)){it.x=nx;it.y=ny;}continue;}
      // Coloured belts block wrong ore type
      if(BELT_TILES.has(nt)){
        const allowed=BELT_ORE[nt];
        if(allowed&&allowed!==it.type)continue; // wrong ore — blocked
      } else if(nt!==T.output&&nt!==T.rnd){continue;}
      if(!free(nx,ny,it.id))continue;
      it.x=nx;it.y=ny;
    }
    state.items=state.items.filter(i=>!remove.has(i.id));
  }

  function tick(){
    if(state.paused)return;
    state.tickBudget=0;
    state.rpmTick=(state.rpmTick+1)%60;
    state.rpmHistory[state.rpmTick]=0;
    for(const m of state.miners){
      if(--m.timer>0)continue;
      m.timer=state.minerInterval;
      const adj=[{x:m.x+1,y:m.y},{x:m.x,y:m.y+1},{x:m.x-1,y:m.y},{x:m.x,y:m.y-1}];
      for(const n of adj){
        if(!inBounds(n.x,n.y))continue;
        const nt=state.grid[n.y][n.x];
        if(!BELT_TILES.has(nt)&&!PROC_TILES.has(nt)&&nt!==T.output&&nt!==T.rnd&&nt!==T.splitter)continue; // miners can output to splitters
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
        if(cfg){
          if(cfg.outStage>=0)it.stage=cfg.outStage;
          if(cfg.valueMult!=null){
            it.value=Math.round(it.value*cfg.valueMult);
            eventLog(`✅ ${REQ[it.type].icon} ×${cfg.valueMult}→${it.value} CZK`,'good');
          } else {
            eventLog(`✅ ${REQ[it.type].icon}→${STAGE_LABEL[it.stage]}`,'good');
          }
        }
      }
    }
    doMovePass();
    if(state.beltPasses>=2)doMovePass();
    checkMilestones();
    maybeEvent();
    checkAchievements();
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
    bmTab('pipelines');
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
    const rpm=s.rpmHistory.reduce((a,b)=>a+b,0);
    set('m-bps',fmt(s.tickBudget)+' CZK');set('m-deploys',s.totalDeploys);set('m-rpm',rpm+'/min');
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
    // Always ensure base-tier buildings are unlocked
    state.unlocked.add('sm36');state.unlocked.add('oss');
    state.unlocked.add('inc_triage');state.unlocked.add('prb_analyst');
    state.splitterCtrs={};state.rpmHistory=new Array(60).fill(0);state.rpmTick=0;
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
    state.budget=800;state.totalDeploys=0;state.tickBudget=0;
    state.grid=genMap();state.items=[];state.miners=[];state.nextId=0;
    state.researched=new Set();state.unlocked=new Set(['compiler','qa_gate','sm36','oss','inc_triage','prb_analyst']);
    state.rp=0;state.rpMilestonesHit=new Set();
    state.beltTickMs=1000;state.hanaCloudMult=1.0;
    state.splitterCtrs={};state.rpmHistory=new Array(60).fill(0);state.rpmTick=0;
    restartTick(1000);
    state.minerInterval=3;state.globalMult=1.0;state.beltPasses=1;
    state.autoBuildings={ service_desk:0, problem_mgmt:0, cab:0 };
    state.abTimers={ service_desk:3, problem_mgmt:5, cab:8 };
    Object.keys(PROC_DEFAULTS).forEach(k=>{ if(T[k]&&PROC_CFG[T[k]]) PROC_CFG[T[k]].ticks=PROC_DEFAULTS[k]; });
    clearItemEls();renderGrid();renderItems();buildResearchPanel();updateUI();
    closeMenu();toast('🔄 Nová hra zahájena!');
    setTimeout(openTutorial,260);
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
    setTimeout(openTutorial,460);
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

  // ── CAMERA PAN (arrow keys scroll the grid wrapper) ───────────────────────
  const PAN_STEP = T_PX * 3; // 3 tiles per keypress
  function panCamera(dx, dy) {
    const w = $('grid-wrapper');
    if (!w) return;
    w.scrollLeft = Math.max(0, w.scrollLeft + dx * PAN_STEP);
    w.scrollTop  = Math.max(0, w.scrollTop  + dy * PAN_STEP);
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

    // Arrow keys = camera pan
    if(e.key==='ArrowUp')   {e.preventDefault();panCamera(0,-1);return;}
    if(e.key==='ArrowDown') {e.preventDefault();panCamera(0, 1);return;}
    if(e.key==='ArrowLeft') {e.preventDefault();panCamera(-1,0);return;}
    if(e.key==='ArrowRight'){e.preventDefault();panCamera( 1,0);return;}

    if(k==='b'){toggleBuildMenu();return;}
    if(k==='`'){toggleHotbar();return;}
    if(e.key==='Tab'){e.preventDefault();cycleBeltMode();return;}
    if(k==='1'){purchaseBuilding('service_desk');return;}
    if(k==='2'){purchaseBuilding('problem_mgmt');return;}
    if(k==='3'){purchaseBuilding('cab');return;}
    // WASD = belt in current mode
    const pfx=BELT_MODE_PREFIX[_beltMode];
    if(k==='w'){selectTool(`${pfx}_u`);return;}
    if(k==='d'){selectTool(`${pfx}_r`);return;}
    if(k==='s'){selectTool(`${pfx}_d`);return;}
    if(k==='a'){selectTool(`${pfx}_l`);return;}
    if(k==='q'){selectTool('miner');return;}
    if(k==='e'){selectTool('compiler');return;}
    if(k==='r'){selectTool('qa_gate');return;}
    if(k==='t'){selectTool('change_board');return;}
    if(k==='y'){selectTool('hana_db');return;}
    if(k==='p'){selectTool('output');return;}
    if(k==='l'){selectTool('rnd');return;}
    if(k==='x'){selectTool('delete');return;}
    if(k==='f'){selectTool('splitter');return;}
    if(k==='g'){selectTool('inc_triage');return;}
    if(k==='j'){selectTool('inc_closer');return;}
    if(k==='n'){selectTool('prb_analyst');return;}
    if(k==='m'){selectTool('prb_rootcause');return;}
    if(k===','){selectTool('prb_change');return;}
    if(k==='v'){selectTool('chg_impact');return;}
    if(k==='k'){selectTool('chg_cab');return;}
    if(k===';'){selectTool('chg_deploy');return;}
  });

  // ── RANDOM EVENTS ─────────────────────────────────────────────────────────
  const EVENTS=[
    {w:15,icon:'🛡',name:'IT Audit',cls:'warn',
      apply(s){const f=Math.max(200,Math.floor(s.budget*.08));s.budget=Math.max(0,s.budget-f);return`Audit odhalil nesoulad — pokuta ${f} CZK`;}},
    {w:14,icon:'🎯',name:'Sprint Review Bonus',cls:'good',
      apply(s){const b=Math.floor(200+Math.random()*400*s.globalMult);s.budget+=b;return`PO spokojený! Bonus +${b} CZK`;}},
    {w:11,icon:'🔥',name:'Výpadek PRD',cls:'warn',
      apply(s){const n=Math.min(s.items.length,2+Math.floor(Math.random()*3));s.items.splice(0,n);return`PRD Outage! ${n} TR ztraceno`;}},
    {w:9,icon:'🤵',name:'SAP Konzultant',cls:'good',
      apply(s){const b=Math.floor(600+Math.random()*900);s.budget+=b;return`Konzultant optimalizoval procesy! +${b} CZK`;}},
    {w:8,icon:'❄',name:'Change Freeze',cls:'warn',
      apply(s){const n=s.items.filter(i=>i.type==='change').length;s.items=s.items.filter(i=>i.type!=='change');return n?`Change Freeze — ${n} CHG zmrazeno!`:`Change Freeze — žádné CHG items`;}},
    {w:8,icon:'🚀',name:'Go-Live Bonus',cls:'good',
      apply(s){const b=Math.floor(s.totalDeploys*12+150);s.budget+=b;return`Úspěšný Go-Live! +${b} CZK (${s.totalDeploys} dep)`;}},
    {w:7,icon:'📞',name:'Zákaznický Escalation',cls:'warn',
      apply(s){const f=Math.floor(100+Math.random()*200);s.budget=Math.max(0,s.budget-f);return`Eskalace od zákazníka — SLA penalizace ${f} CZK`;}},
    {w:6,icon:'📝',name:'SAP Note Oprava',cls:'good',
      apply(s){const b=Math.floor(180+Math.random()*220);s.budget+=b;return`Kritická SAP Note aplikována! Úspora +${b} CZK`;}},
    {w:5,icon:'💀',name:'Kybernetický Útok',cls:'warn',
      apply(s){const f=Math.max(500,Math.floor(s.budget*.14));s.budget=Math.max(0,s.budget-f);return`Ransomware incident — záplata stála ${f} CZK`;}},
    {w:5,icon:'👔',name:'Šéf na Inspekci',cls:'good',
      apply(s){s.globalMult=+(s.globalMult*1.05).toFixed(4);return`Šéf impressed — permanentní +5% mult (nyní ×${s.globalMult.toFixed(2)})`;}},
    {w:4,icon:'🌊',name:'IDoc Flood',cls:'good',
      apply(s){let n=0;for(const m of s.miners.slice(0,3)){const adj=[{dx:1,dy:0},{dx:0,dy:1},{dx:-1,dy:0},{dx:0,dy:-1}];for(const a of adj){const nx=m.x+a.dx,ny=m.y+a.dy;if(!inBounds(nx,ny))continue;const nt=s.grid[ny][nx];if(BELT_TILES.has(nt)&&!s.items.find(i=>i.x===nx&&i.y===ny)){s.items.push({id:s.nextId++,x:nx,y:ny,type:m.type,value:REQ[m.type].value,stage:0,delay:0,pdx:0,pdy:0});n++;break;}}}return`IDoc Flood! ${n} extra items injektováno`;}},
    {w:4,icon:'🏎',name:'Škoda Board Review',cls:'good',
      apply(s){const b=Math.floor(1200+s.totalDeploys*18);s.budget+=b;return`Board impressed! Jednorázový bonus ${b} CZK`;}},
    {w:3,icon:'💾',name:'Disk Crash',cls:'warn',
      apply(s){const n=Math.floor(s.items.length/2);s.items.splice(0,n);return`Disk crash! ${n} TR ztraceno nenávratně`;}},
    {w:3,icon:'🔓',name:'Compliance Certifikát',cls:'good',
      apply(s){const b=Math.floor(800+Math.random()*600);s.budget+=b;s.globalMult=+(s.globalMult*1.03).toFixed(4);return`ISO certifikát získán! +${b} CZK +3% mult`;}},
  ];
  const _evW=EVENTS.reduce((s,e)=>s+e.w,0);
  let _evTick=0;
  const EV_INTERVAL=30;

  function maybeEvent(){
    if(state.miners.length===0)return;
    if(++_evTick<EV_INTERVAL)return;
    _evTick=0;
    let r=Math.random()*_evW;
    let ev=EVENTS[EVENTS.length-1];
    for(const e of EVENTS){r-=e.w;if(r<=0){ev=e;break;}}
    const msg=ev.apply(state);
    if(!msg)return;
    const banner=$('event-banner');
    banner.textContent=`${ev.icon} ${ev.name}: ${msg}`;
    banner.className=ev.cls==='warn'?'ev-warn':'ev-good';
    banner.classList.remove('hidden');
    clearTimeout(toast._t);
    toast._t=setTimeout(()=>banner.classList.add('hidden'),5500);
    eventLog(`${ev.icon} ${msg}`,ev.cls);
    renderItems();updateUI();
  }

  // ── ACHIEVEMENTS ──────────────────────────────────────────────────────────
  const ACHIEVEMENTS=[
    {id:'first',  icon:'🚀',label:'První Deploy!',       check:s=>s.totalDeploys>=1},
    {id:'d10',    icon:'📦',label:'10 deployů',          check:s=>s.totalDeploys>=10},
    {id:'d100',   icon:'💯',label:'100 deployů!',        check:s=>s.totalDeploys>=100},
    {id:'mil',    icon:'💰',label:'Milionář! 1M CZK',    check:s=>s.budget>=1_000_000},
    {id:'m5',     icon:'⛏',label:'5 Minerů',            check:s=>s.miners.length>=5},
    {id:'rp50',   icon:'🔬',label:'50 RP dosaženo',      check:s=>s.rp>=50},
    {id:'rp400',  icon:'🗄',label:'HANA odemčena (400 RP)',check:s=>s.rp>=400||s.unlocked.has('hana_db')},
    {id:'full',   icon:'🏆',label:'Plný výzkum!',        check:s=>s.researched.size>=Object.keys(RESEARCH).length},
    {id:'hana',   icon:'⚡',label:'HANA deploy! ×4.8',   check:s=>s.totalDeploys>=1&&s.unlocked.has('hana_db')&&s.items.some(i=>i.stage===4)},
    {id:'budget5k',icon:'💎',label:'5k CZK budget',      check:s=>s.budget>=5000},
  ];
  const _achieved=new Set();

  function checkAchievements(){
    for(const a of ACHIEVEMENTS){
      if(_achieved.has(a.id))continue;
      if(!a.check(state))continue;
      _achieved.add(a.id);
      showAchievement(a);
      eventLog(`🏆 Achievement: ${a.label}`,'good');
    }
  }

  function showAchievement(a){
    const el=document.createElement('div');
    el.className='ach-toast';
    el.innerHTML=`<span class="ach-icon">${a.icon}</span><div><div class="ach-head">Achievement!</div><div class="ach-lbl">${a.label}</div></div>`;
    document.body.appendChild(el);
    requestAnimationFrame(()=>requestAnimationFrame(()=>el.classList.add('ach-show')));
    setTimeout(()=>{el.classList.remove('ach-show');setTimeout(()=>el.remove(),400);},3500);
  }

  // ── TICK MANAGEMENT ────────────────────────────────────────────────────────
  let _tickHandle=null;
  function updateItemTransition(ms){
    // CSS transition duration slightly under tick interval → items arrive just before next tick
    document.documentElement.style.setProperty('--item-ms',(Math.round((ms||1000)*0.93))+'ms');
  }
  function restartTick(ms){
    if(_tickHandle)clearInterval(_tickHandle);
    _tickHandle=setInterval(tick,ms||1000);
    updateItemTransition(ms||1000);
  }

  function toggleTheme(){
    const light=document.body.classList.toggle('light');
    const btn=$('theme-btn');if(btn)btn.textContent=light?'🌙 Dark':'☀ Light';
  }

  // ── TUTORIAL ─────────────────────────────────────────────────────────────
  const TUT_STEPS = [
    { icon:'🎮', title:'Vítej v SAP GCC Factorio', target:null, html:
      `<p>Jsi inženýr v <b>SAP GCC</b> Škoda Auto. Úkol: postavit <b>výrobní linku</b>, která zpracuje ITIL tickety a deployne je do produkce za peníze. 💰</p>
       <p>Funguje to jako Factorio: <b>těžíš</b> suroviny → vedeš je <b>dopravníky</b> → <b>zpracuješ</b> v budovách → <b>prodáš</b> v PRD stanici.</p>
       <p>Projdeme to krok za krokem. <kbd>→</kbd> / <kbd>Enter</kbd> = dál, <kbd>Esc</kbd> = přeskočit.</p>` },

    { icon:'💰', title:'Co sleduješ nahoře', target:'#topbar-stats', html:
      `<p>V horní liště máš klíčové ukazatele:</p>
       <ul>
         <li><b>Budget</b> — tvoje CZK, za ně stavíš. Začínáš s <b>800 CZK</b>.</li>
         <li><b>Items</b> — kolik ticketů je právě na linkách.</li>
         <li><b>RP</b> — Research Points, za ně odemykáš pokročilé budovy.</li>
       </ul>
       <p>Cíl: roztočit linku tak, aby <b>Budget</b> sám rostl.</p>` },

    { icon:'⛏', title:'1 · Těž suroviny', target:'.hb-slot[data-tool="miner"]', html:
      `<p>Na mapě jsou barevné <b>ore patche</b> — tři typy ticketů:</p>
       <ul>
         <li><span class="tut-chip" style="color:var(--blue2)">INC</span> Incident — levný, base 50</li>
         <li><span class="tut-chip" style="color:var(--orange)">PRB</span> Problem — base 150</li>
         <li><span class="tut-chip" style="color:var(--purple)">CHG</span> Change — drahý, base 400</li>
       </ul>
       <p>Vyber <b>Miner</b> (<kbd>Q</kbd>) a klikni na ore patch. Pak každé <b>3 s</b> vytěží jeden ticket.</p>` },

    { icon:'▶', title:'2 · Postav dopravníky', target:'#belt-mode-bar', html:
      `<p>Items se samy nepohnou — potřebují <b>belty</b>. Pokládáš je klávesami <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> podle směru toku.</p>
       <p>Belty jsou <b>barevné podle typu</b> ticketu. Klávesou <kbd>Tab</kbd> přepínáš 🔵 INC / 🟠 PRB / 🟣 CHG. Barva beltu musí sedět na surovinu, kterou veze.</p>
       <p>Veď belt z mineru směrem k budovám.</p>` },

    { icon:'⚙', title:'3 · Zpracuj items', target:'.hb-slot[data-tool="compiler"]', html:
      `<p>Každá budova posune ticket o <b>stage</b> výš a znásobí jeho hodnotu:</p>
       <ul>
         <li>⚙ <b>Compiler</b> (<kbd>E</kbd>) — RAW → TR, ×1.5</li>
         <li>✔ <b>QA Gate</b> (<kbd>R</kbd>) — TR → QA✓, ×2.1</li>
         <li>📋 <b>Change Board</b> (<kbd>T</kbd>) — ×3.2 <i>(za RP)</i></li>
         <li>🗄 <b>HANA DB</b> (<kbd>Y</kbd>) — ×4.8 <i>(za RP)</i></li>
       </ul>
       <p>Polož budovu na cestu beltu — item skrz ni projede a zhodnotí se.</p>` },

    { icon:'🏭', title:'4 · Deployuj do PRD', target:'.hb-slot[data-tool="output"]', html:
      `<p>Na konec linky postav <b>PRD Deploy Station</b> (<kbd>P</kbd>). Když na ni dorazí zpracovaný ticket, <b>prodá se</b> a hodnota naskáče do Budgetu. 💰</p>
       <p>Čím víc stagí ticket projde, tím víc CZK dostaneš. Plná INC linka až do HANA = <b>360 CZK</b> místo 75 za surový.</p>` },

    { icon:'🔬', title:'5 · Výzkum a odemykání', target:'.hb-slot[data-tool="rnd"]', html:
      `<p><b>R&amp;D Lab</b> (<kbd>L</kbd>) místo prodeje mění tickety na <b>Research Points (RP)</b>.</p>
       <p>Za RP postupně odemykáš:</p>
       <ul>
         <li><b>50 RP</b> → Change Board</li>
         <li><b>150 RP</b> → Express belty 2×</li>
         <li><b>400 RP</b> → HANA DB</li>
       </ul>
       <p>… plus automatizované pipeline buildery v katalogu.</p>` },

    { icon:'🤖', title:'6 · Automatizace', target:'.hb-catalogue', html:
      `<p>Nechce se ti pokládat minery ručně? V katalogu (<kbd>B</kbd> → záložka <b>Automation</b>) koupíš budovy, které <b>samy injektují</b> tickety:</p>
       <ul>
         <li>🎧 <b>Service Desk</b> (<kbd>1</kbd>) — INC každé 3 s</li>
         <li>🔧 <b>Problem Mgmt</b> (<kbd>2</kbd>) — PRB každé 5 s</li>
         <li>📋 <b>CAB</b> (<kbd>3</kbd>) — CHG každé 8 s</li>
       </ul>
       <p>Pasivní přísun → linka jede sama.</p>` },

    { icon:'⌨', title:'Ovládání a ukládání', target:'.hb-catalogue', html:
      `<p>Pár klíčových kláves:</p>
       <ul>
         <li><kbd>B</kbd> — Blueprint katalog (všechny budovy)</li>
         <li><kbd>↑↓←→</kbd> posun mapy · <kbd>X</kbd> smazat budovu/belt</li>
         <li><kbd>Esc</kbd> — menu (pauza)</li>
         <li><kbd>Ctrl</kbd>+<kbd>S</kbd> — rychlé uložení</li>
       </ul>
       <p>Pozor na <b>náhodné události</b> (audity, výpadky) — můžou ubrat i přidat CZK.</p>` },

    { icon:'🚀', title:'A jde se na to!', target:null, html:
      `<p>Doporučený první řetězec:</p>
       <p style="text-align:center;font-size:.95rem"><b>⛏ → ⚙ → ✔ → 🏭 PRD</b></p>
       <p>Postav Miner na INC patch, veď belty přes Compiler a QA Gate do PRD stanice — a sleduj, jak Budget roste. Pak reinvestuj do dalších linek a výzkumu.</p>
       <p>Tutoriál znovu otevřeš kdykoli z menu (<kbd>Esc</kbd>). Hodně štěstí! 🎮</p>` },
  ];
  let tutIndex = 0;

  function positionTut(step){
    const sp=$('tut-spotlight'), card=$('tut-card');
    if(!sp||!card)return;
    let el=null;
    if(step&&step.target){ try{ el=document.querySelector(step.target); }catch(e){} }
    if(!el){
      sp.classList.remove('on');
      card.classList.remove('anchored');
      card.style.left='50%'; card.style.top='50%';
      return;
    }
    const r=el.getBoundingClientRect(), pad=6;
    sp.style.left=(r.left-pad)+'px';
    sp.style.top=(r.top-pad)+'px';
    sp.style.width=(r.width+pad*2)+'px';
    sp.style.height=(r.height+pad*2)+'px';
    sp.classList.add('on');
    card.classList.add('anchored');
    const cw=card.offsetWidth||440, ch=card.offsetHeight||300;
    const vw=innerWidth, vh=innerHeight, m=16;
    const left=Math.min(Math.max(m, r.left+r.width/2-cw/2), vw-cw-m);
    const below=r.bottom+14, above=r.top-ch-14;
    let top;
    if(r.top>vh*0.5 && above>=m) top=above;
    else if(below+ch<=vh-m) top=below;
    else if(above>=m) top=above;
    else top=Math.max(m,(vh-ch)/2);
    card.style.left=left+'px';
    card.style.top=top+'px';
  }

  function renderTut(){
    const s=TUT_STEPS[tutIndex];
    $('tut-step-icon').textContent=s.icon;
    $('tut-step-title').textContent=s.title;
    $('tut-step-count').textContent=`Krok ${tutIndex+1} / ${TUT_STEPS.length}`;
    $('tut-body').innerHTML=s.html;
    const dots=$('tut-dots'); dots.innerHTML='';
    TUT_STEPS.forEach((_,i)=>{
      const d=document.createElement('div');
      d.className='tut-dot'+(i===tutIndex?' active':'');
      d.onclick=()=>tutGoto(i);
      dots.appendChild(d);
    });
    $('tut-prev').disabled = tutIndex===0;
    $('tut-next').textContent = tutIndex===TUT_STEPS.length-1 ? 'Začít hru ▶' : 'Dál ›';
    requestAnimationFrame(()=>positionTut(s));
  }

  function openTutorial(){
    if(!$('menu-overlay').classList.contains('hidden')) closeMenu();
    tutIndex=0;
    state.paused=true;
    $('tut-overlay').classList.remove('hidden');
    renderTut();
  }

  function closeTutorial(){
    $('tut-overlay').classList.add('hidden');
    $('tut-spotlight').classList.remove('on');
    try{ localStorage.setItem('sap_tut_seen','1'); }catch(e){}
    const titleUp=!$('title-overlay').classList.contains('hidden');
    const menuUp =!$('menu-overlay').classList.contains('hidden');
    if(!titleUp && !menuUp) state.paused=false;
  }

  function tutNext(){ if(tutIndex>=TUT_STEPS.length-1){closeTutorial();return;} tutIndex++; renderTut(); }
  function tutPrev(){ if(tutIndex>0){tutIndex--; renderTut();} }
  function tutGoto(n){ tutIndex=Math.max(0,Math.min(TUT_STEPS.length-1,n)); renderTut(); }

  // Tutorial keyboard nav — capture phase so it pre-empts the global handler
  document.addEventListener('keydown', e=>{
    if($('tut-overlay').classList.contains('hidden'))return;
    if(e.key==='Escape'){ e.preventDefault(); e.stopPropagation(); closeTutorial(); }
    else if(e.key==='ArrowRight'||e.key==='Enter'){ e.preventDefault(); e.stopPropagation(); tutNext(); }
    else if(e.key==='ArrowLeft'){ e.preventDefault(); e.stopPropagation(); tutPrev(); }
  }, true);
  window.addEventListener('resize',()=>{
    if(!$('tut-overlay').classList.contains('hidden')) positionTut(TUT_STEPS[tutIndex]);
  });

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
           purchaseBuilding, openBuildMenu, closeBuildMenu, toggleBuildMenu, toggleHotbar, setBeltMode,
           openTutorial, closeTutorial, tutNext, tutPrev, tutGoto };
})();
