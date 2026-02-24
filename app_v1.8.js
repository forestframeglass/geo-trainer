// ======= Version =======
const VERSION = "1.8";

// ======= Utility & normalization =======
function normalize(s){
  return (s||"")
    .toString().trim().toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[\u2019\u2018]/g, "'")
    .replace(/[^\p{L}\p{N}\s']/gu, " ")
    .replace(/\s+/g, " ")
    .replace(/^the\s+/, "");
}
function asSet(arr){ const set=new Set(); for(const a of (arr||[])) set.add(normalize(a)); return set; }
function answerMatches(input, valid){ return valid.has(normalize(input)); }
function shuffle(a){ const arr=a.slice(); for(let i=arr.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [arr[i],arr[j]]=[arr[j],arr[i]]; } return arr; }
function fmtMS(ms){ const t=Math.floor(ms/1000); const m=String(Math.floor(t/60)).padStart(2,'0'); const s=String(t%60).padStart(2,'0'); const d=Math.floor((ms%1000)/100); return `${m}:${s}.${d}`; }
function fmtDate(ts){ const d=new Date(ts); const y=d.getFullYear(); const m=String(d.getMonth()+1).padStart(2,'0'); const day=String(d.getDate()).padStart(2,'0'); return `${y}-${m}-${day}`; }

// ======= DOM =======
const modeButtons=[...document.querySelectorAll('.modes button')];
const promptEl=document.getElementById('prompt');
const dupBadge=document.getElementById('dupBadge');
const flagWrap=document.getElementById('flagWrap');
const flagImg=document.getElementById('flagImg');
const form=document.getElementById('answerForm');
const input=document.getElementById('answerInput');
const feedback=document.getElementById('feedback');
const revealBtn=document.getElementById('revealBtn');
const newGameBtn=document.getElementById('newGame');
const qIndexEl=document.getElementById('qIndex');
const qTotalEl=document.getElementById('qTotal');
const remainingEl=document.getElementById('remaining');
const correctEl=document.getElementById('correct');
const streakEl=document.getElementById('streak');
const bestStreakEl=document.getElementById('bestStreak');
const revealsEl=document.getElementById('reveals');
const timerEl=document.getElementById('timer');
const revealedBody=document.getElementById('revealedBody');
const leaderboardBody=document.getElementById('leaderboardBody');
const clearLbBtn=document.getElementById('clearLeaderboard');

// ======= State =======
let DATA = window.DATA || [];
let MODE='flag-to-country';
let QUEUE=[];
let qIndex=0, correct=0, streak=0, bestStreak=0, reveals=0; let revealed=[];
let startTs=0, tickHandle=null, finished=false; let qShownTs=0;

// Cluster handling
const USED_BY_CLUSTER = {}; // key -> Set(entityKey)
function clusterKey(q){
  if((q.type==='flag-to-country'||q.type==='flag-to-capital')){
    if(q.flagDupGroup) return 'flagdup::'+normalize(q.flagDupGroup);
    if(q.flag) return 'flag::'+q.flag;
  }
  if(q.type==='capital-to-country'){
    if(q.capDupGroup) return 'capdup::'+normalize(q.capDupGroup);
    if(q.prompt) return 'cap::'+normalize(q.prompt);
  }
  return null;
}
function entityKeyForRow(row, expect){ return expect==='country'? normalize(row.country) : normalize(row.capital); }
function answerSetForRow(row, expect){ return expect==='country'? asSet([row.country, ...(row.countryAlt||[])]) : asSet([row.capital, ...(row.capitalAlt||[])]); }
function buildUnionValidExcludingUsed(q){
  const original = new Set(q.expect==='country'? q.countrySet : q.capitalSet);
  const key = clusterKey(q);
  if(!key) return { valid: original, rows: [], used:new Set(), key:null, clusterLabel:null };
  let rows=[]; let clusterLabel=null;
  if(key.startsWith('flagdup::')){ const g=key.slice('flagdup::'.length); rows = DATA.filter(r=> normalize(r.flagDupGroup||'')===g); clusterLabel=q.flagDupGroup; }
  else if(key.startsWith('flag::')){ const p=key.slice('flag::'.length); rows = DATA.filter(r=> r.flag===p); clusterLabel=''; }
  else if(key.startsWith('capdup::')){ const g=key.slice('capdup::'.length); rows = DATA.filter(r=> normalize(r.capDupGroup||'')===g); clusterLabel=q.capDupGroup; }
  else if(key.startsWith('cap::')){ const cap=key.slice('cap::'.length); rows = DATA.filter(r=> normalize(r.capital)===cap); clusterLabel=q.prompt; }
  const used = USED_BY_CLUSTER[key] || new Set();
  const union = new Set();
  for(const r of rows){ const ek=entityKeyForRow(r,q.expect); const aset=answerSetForRow(r,q.expect); if(!used.has(ek)){ for(const v of aset) union.add(v); } }
  return { valid: (union.size? union : original), rows, used, key, clusterLabel };
}
function consumeEntityForCluster(q, info, chosenNorm){
  if(!info || !info.key) return;
  let ek=null; for(const r of info.rows){ const aset=answerSetForRow(r,q.expect); if(aset.has(chosenNorm)){ ek=entityKeyForRow(r,q.expect); break; } }
  if(!ek) ek = normalize(q.label);
  USED_BY_CLUSTER[info.key] = USED_BY_CLUSTER[info.key] || new Set();
  USED_BY_CLUSTER[info.key].add(ek);
}

// ======= Leaderboard (mode-scoped, includes bestStreak) =======
function lbKeyFor(mode){ return `geo.lb.${mode}.v${VERSION}`; }
function loadLB(mode){ try{ return JSON.parse(localStorage.getItem(lbKeyFor(mode)))||[]; }catch{ return []; } }
function saveLB(mode,list){ localStorage.setItem(lbKeyFor(mode), JSON.stringify(list)); }
function addLB(mode, ms, stats){ const item={ ms, when: Date.now(), stats}; const list=loadLB(mode).concat(item)
  .sort((a,b)=>a.ms-b.ms).slice(0,10); saveLB(mode,list); renderLB(mode,item.when); }
function renderLB(mode, latestWhen){ const list=loadLB(mode); if(leaderboardBody) leaderboardBody.innerHTML=""; list.forEach((it,idx)=>{ const tr=document.createElement('tr'); if(latestWhen && it.when===latestWhen) tr.classList.add('latest');
  const c1=document.createElement('td'); c1.textContent=String(idx+1);
  const c2=document.createElement('td'); c2.textContent=fmtMS(it.ms);
  const c3=document.createElement('td'); c3.textContent=fmtDate(it.when);
  const c4=document.createElement('td'); c4.textContent=String(it.stats.reveals);
  const c5=document.createElement('td'); c5.textContent=String(it.stats.bestStreak||0);
  tr.appendChild(c1); tr.appendChild(c2); tr.appendChild(c3); tr.appendChild(c4); tr.appendChild(c5); leaderboardBody.appendChild(tr); }); }

// ======= Data → Questions =======
function makeAnswerSets(row){ const countrySet=asSet([row.country, ...(row.countryAlt||[])]); const capitalSet=asSet([row.capital, ...(row.capitalAlt||[])]); return { countrySet, capitalSet }; }
function makeQueue(mode, rows){ const q=[]; for(const row of rows){ const {countrySet,capitalSet}=makeAnswerSets(row);
  // For flag-based modes, only include if row.flag is defined (SVG or embedded available)
  if((mode==='flag-to-country' || mode==='flag-to-capital')){
    if(row.flag){
      if(mode==='flag-to-country') q.push({type:mode, flag:row.flag, flagDupGroup:row.flagDupGroup, capDupGroup:row.capDupGroup, expect:'country', countrySet, capitalSet, label:row.country, prompt:null});
      else q.push({type:mode, flag:row.flag, flagDupGroup:row.flagDupGroup, capDupGroup:row.capDupGroup, expect:'capital', countrySet, capitalSet, label:row.capital, prompt:null});
    }
  } else if(mode==='capital-to-country'){
    q.push({type:mode, flagDupGroup:row.flagDupGroup, capDupGroup:row.capDupGroup, prompt:row.capital, expect:'country', countrySet, capitalSet, label:row.country});
  } else if(mode==='country-to-capital'){
    q.push({type:mode, flagDupGroup:row.flagDupGroup, capDupGroup:row.capDupGroup, prompt:row.country, expect:'capital', countrySet, capitalSet, label:row.capital});
  }
 }
 return shuffle(q);
}

// ======= Feedback (trimmed) =======
const FB = {
  correct: [
    "Spot on—look at you, geography wizard.",
    "Nice one—clean hit.",
    "Bang on.",
    "Exactly right—keep it rolling.",
    "You beauty."
  ],
  streak3: ["Hat‑trick! {streak} on the trot—don’t jinx it.", "Three’s a charm—{streak} straight."],
  streak5: ["On a heater—{streak} in a row.", "Scorching—{streak} straight."],
  streak7: ["You’re flying: {streak} straight.", "Ridiculous form—{streak} and counting."],
  streak10:["Absurd. {streak} on the spin.", "Unstoppable—{streak} and counting."],
  fast: [ "Lightning—blink and you’d miss it.", "Turbo. The map fears you." ],
  wrong: [ "Close—but no postcard from there.", "Right idea, wrong postcode.", "Not quite—back in you go." ],
  near: [ "So close—drop the extra letter and it’s yours.", "Right answer, scruffy spelling." ],
  dupReused: [ "We already used that one for this {cluster} set—try its twin." ],
  endGreat: [ "Elite stuff—{correct}/{total} with {reveals} reveal(s). Time {time}." ],
  endGood: [ "Solid session—polish a couple and you’ll fly." ],
  endPractice: [ "Foundations down; next pass goes brrr." ]
};
let _lastLine = "";
function pick(arr){ const pool = arr.filter(l=>l!==_lastLine); const line = pool[Math.floor(Math.random()*pool.length)] || arr[0]; _lastLine=line; return line; }
function fmtT(s, ctx){ return s.replace(/\{(\w+)\}/g, (_,k)=> (ctx[k]!==undefined?ctx[k]:"")); }
function feedbackCorrect(ctx){
  if(ctx.fast) return pick(FB.fast);
  if(ctx.streak>=10) return fmtT(pick(FB.streak10), ctx);
  if(ctx.streak>=7) return fmtT(pick(FB.streak7), ctx);
  if(ctx.streak>=5) return fmtT(pick(FB.streak5), ctx);
  if(ctx.streak>=3) return fmtT(pick(FB.streak3), ctx);
  return pick(FB.correct);
}
function feedbackWrong(ctx){ if(ctx.dupReused && ctx.cluster) return fmtT(pick(FB.dupReused), ctx); if(ctx.isNear) return pick(FB.near); return pick(FB.wrong); }
function feedbackEnd(ctx){ const acc = ctx.correct/ctx.total; if(acc>=0.9 && ctx.reveals <= Math.max(1, Math.round(ctx.total*0.05))) return fmtT(pick(FB.endGreat), ctx); if(acc>=0.7) return fmtT(pick(FB.endGood), ctx); return fmtT(pick(FB.endPractice), ctx); }

// ======= Game lifecycle =======
function resetCounters(total){ qIndex=0; correct=0; streak=0; reveals=0; bestStreak=0; revealed=[]; finished=false; for(const k in USED_BY_CLUSTER) delete USED_BY_CLUSTER[k]; qTotalEl.textContent=total; updateCounters(); revealedBody.innerHTML=''; feedback.textContent=''; feedback.className='feedback'; }
function updateCounters(){ qIndexEl.textContent=Math.min(qIndex+1, QUEUE.length); remainingEl.textContent=Math.max(QUEUE.length - qIndex - (finished?0:1), 0); correctEl.textContent=correct; streakEl.textContent=streak; if(bestStreakEl) bestStreakEl.textContent=bestStreak; revealsEl.textContent=reveals; }
function startTimer(){ startTs=performance.now(); clearInterval(tickHandle); tickHandle=setInterval(()=>{ timerEl.textContent=fmtMS(performance.now()-startTs); }, 100); }
function stopTimer(){ clearInterval(tickHandle); tickHandle=null; }
function renderQuestion(){ const q=QUEUE[qIndex]; if(!q) return; qShownTs = performance.now();
  const info = buildUnionValidExcludingUsed(q);
  if(info && info.rows && info.rows.length>1) { dupBadge.classList.remove('hidden'); dupBadge.textContent = "multiple answers available, don't reuse the same one"; } else { dupBadge.classList.add('hidden'); }
  if(q.type==='flag-to-country' || q.type==='flag-to-capital') { flagWrap.classList.remove('hidden'); flagImg.src=q.flag; flagImg.onerror=()=>{ flagImg.alt='Flag (failed to load)'; }; promptEl.textContent = (q.type==='flag-to-country')? 'Which country is this flag?' : "What is the capital of this flag's country?"; }
  else { flagWrap.classList.add('hidden'); if(q.type==='capital-to-country'){ promptEl.innerHTML = `Capital: <strong>${q.prompt}</strong> — which country?`; } else { promptEl.innerHTML = `Country: <strong>${q.prompt}</strong> — what is the capital?`; } }
  input.value=''; input.disabled=false; revealBtn.disabled=false; input.focus(); updateCounters(); }
function renderRevealed(){ revealedBody.innerHTML=''; for(const r of revealed){ const tr=document.createElement('tr'); const tdQ=document.createElement('td'); if(r.flag){ const img=document.createElement('img'); img.src=r.flag; img.alt='Flag'; tdQ.appendChild(img); } else { tdQ.textContent=r.prompt||''; } const tdA=document.createElement('td'); tdA.textContent=r.answer||''; const tdG=document.createElement('td'); tdG.textContent=r.guess||''; tr.appendChild(tdQ); tr.appendChild(tdA); tr.appendChild(tdG); revealedBody.appendChild(tr); } }
