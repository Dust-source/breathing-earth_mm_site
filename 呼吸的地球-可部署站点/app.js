/* global Chart, CLIMATE_DATA */
(function(){
'use strict';
const D = window.CLIMATE_DATA;
const GAS = {
  co2:{name:'二氧化碳',color:'#2a8a5b',rgb:'42,138,91'},
  ch4:{name:'甲烷',color:'#d9a441',rgb:'217,164,65'},
  n2o:{name:'氧化亚氮',color:'#4a90c2',rgb:'74,144,194'},
  sf6:{name:'六氟化硫',color:'#e07a5f',rgb:'224,122,95'}
};
const $ = s=>document.querySelector(s);
const $$ = s=>Array.from(document.querySelectorAll(s));

/* ---------- 通用 Chart 配置 ---------- */
const fontColor='#4a6b5c', gridColor='rgba(18,94,63,.08)';
Chart.defaults.font.family="'Inter','Noto Sans SC',sans-serif";
Chart.defaults.color=fontColor;
function baseOpts(extra){
  return Object.assign({
    responsive:true,maintainAspectRatio:false,animation:{duration:900,easing:'easeOutQuart'},
    interaction:{mode:'index',intersect:false},
    plugins:{legend:{display:false},tooltip:{backgroundColor:'#0b2a1e',padding:12,titleFont:{size:13},bodyFont:{size:12},cornerRadius:10,displayColors:true,boxPadding:6}},
    scales:{
      x:{grid:{color:gridColor},border:{display:false},ticks:{color:fontColor,maxTicksLimit:9,font:{size:11}}},
      y:{grid:{color:gridColor},border:{display:false},ticks:{color:fontColor,font:{size:11}}}
    }
  },extra||{});
}

/* ---------- 气体概览卡 ---------- */
function sparklineSVG(values,color){
  const w=200,h=46,pad=3;
  const min=Math.min.apply(null,values),max=Math.max.apply(null,values),span=(max-min)||1;
  const pts=values.map((v,i)=>[(i/(values.length-1))*w, h-pad-((v-min)/span)*(h-2*pad)]);
  const line=pts.map((p,i)=>(i?'L':'M')+p[0].toFixed(1)+' '+p[1].toFixed(1)).join(' ');
  const area=line+' L'+w+' '+h+' L0 '+h+' Z';
  const gid='sg'+Math.random().toString(36).slice(2,8);
  return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" style="width:100%;height:100%;display:block">
    <defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${color}" stop-opacity=".28"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></linearGradient></defs>
    <path d="${area}" fill="url(#${gid})"/><path d="${line}" fill="none" stroke="${color}" stroke-width="2" vector-effect="non-scaling-stroke"/></svg>`;
}
function buildGasCards(){
  const grid=$('#gasGrid');
  Object.keys(GAS).forEach(k=>{
    const g=D.gases[k], meta=GAS[k];
    const change=Math.round((g.last/g.first-1)*100);
    const card=document.createElement('div');
    card.className='gas-card'; card.dataset.gas=k; card.style.setProperty('--gc',meta.color);
    card.innerHTML=`<div class="gc-top"><div class="gas-sym">${k==='co2'?'CO<sub>2</sub>':k==='ch4'?'CH<sub>4</sub>':k==='n2o'?'N<sub>2</sub>O':'SF<sub>6</sub>'}</div><span class="gas-unit">${g.unit}</span></div>
      <div class="gas-name">${meta.name} · ${g.first_year}–${g.last_year}</div>
      <div class="gas-val">${g.last}<small> ${g.unit}</small></div>
      <div class="gas-change">↑ ${change}% 自 ${g.first_year}</div>
      <div class="gas-spark-box">${sparklineSVG(g.annual.map(p=>p[1]),meta.color)}</div>`;
    grid.appendChild(card);
  });
}

/* ---------- 主时间轴 ---------- */
let mainChart=null, currentGas='co2', showTrend=true;
function buildGasToggle(){
  const box=$('#gasToggle');
  Object.keys(GAS).forEach(k=>{
    const b=document.createElement('button');
    b.className='toggle-btn'+(k===currentGas?' active':'');
    b.textContent=GAS[k].name; b.dataset.gas=k;
    b.onclick=()=>setGas(k);
    box.appendChild(b);
  });
}
function setGas(k){
  currentGas=k;
  $$('.toggle-btn').forEach(b=>b.classList.toggle('active',b.dataset.gas===k));
  $$('.gas-card').forEach(c=>c.classList.toggle('active',c.dataset.gas===k));
  renderMain();
}
function renderMain(){
  const g=D.gases[currentGas], meta=GAS[currentGas];
  const monthly=g.monthly; // [decimal, avg, trend]
  const ds=[{label:meta.name+' 月均',data:monthly.map(m=>[m[0],m[1]]),borderColor:meta.color,borderWidth:1.6,
    pointRadius:0,pointHoverRadius:4,tension:0,fill:true,backgroundColor:'rgba('+meta.rgb+',0.10)'}];
  if(showTrend) ds.push({label:'长期趋势',data:monthly.map(m=>[m[0],m[2]]),borderColor:'#9fb3a7',borderWidth:2,borderDash:[6,4],pointRadius:0,tension:0,fill:false});
  const opts=baseOpts({
    scales:{
      x:{type:'linear',grid:{color:gridColor},border:{display:false},ticks:{color:fontColor,maxTicksLimit:11,font:{size:11},callback:v=>Math.round(v)}},
      y:{grid:{color:gridColor},border:{display:false},ticks:{color:fontColor,font:{size:11}},title:{display:true,text:g.unit,color:fontColor,font:{size:11}}}
    },
    plugins:{legend:{display:false},tooltip:{backgroundColor:'#0b2a1e',padding:12,cornerRadius:10,
      callbacks:{title:it=>{const yr=Math.floor(it[0].parsed.x);const mo=Math.round((it[0].parsed.x-yr)*12)+1;return yr+' 年 '+(mo>0?mo:1)+' 月';},label:it=>it.dataset.label+': '+it.parsed.y+' '+g.unit}}}
  });
  if(mainChart){mainChart.destroy();mainChart=null;}
  mainChart=new Chart($('#mainChart').getContext('2d'),{type:'line',data:{datasets:ds},options:opts});
  placeKeelingBubble();
}

/* ---------- Keeling 气泡定位 ---------- */
function placeKeelingBubble(){
  const g=D.gases[currentGas];
  if(g.first_year>1976){$('#keelingBubble').style.display='none';return;}
  $('#keelingBubble').style.display='block';
  const cv=$('#mainChart'), wrap=$('#mainChartWrap');
  const xMin=g.monthly[0][0], xMax=g.monthly[g.monthly.length-1][0];
  const plotL=44, plotR=wrap.clientWidth-12; // 近似图表区
  const ratio=(1976-xMin)/(xMax-xMin);
  const px=plotL+ratio*(plotR-plotL);
  $('#keelingBubble').style.left=px+'px';
  $('#keelingBubble').style.top='14px';
}

/* ---------- 事件数据 ---------- */
const EVENTS=[
  {year:1985,gas:'co2',level:'B',title:'1980 年代的能效提升',desc:'第二次石油危机后，全球能效提升与核电扩张，使 1980–1984 年 CO₂ 年均增速降至约 1.03 ppm/yr，是全程最低的一段。',gasLabel:'CO₂'},
  {year:1987,gas:'ch4',level:'B',title:'蒙特利尔议定书签署',desc:'消耗臭氧层物质被逐步淘汰，大气中 OH 自由基（甲烷的主要清除者）浓度上升，可能是此后 CH₄ 增速放缓的机制之一。',gasLabel:'CH₄'},
  {year:1991,gas:'co2',level:'A',title:'皮纳图博火山喷发',desc:'平流层气溶胶使全球短期降温，陆地呼吸减弱、碳汇增强，CO₂ 增长率出现可见凹陷。这是有直接观测支持的事件。',gasLabel:'CO₂'},
  {year:1991,gas:'ch4',level:'B',title:'苏联解体后的经济衰退',desc:'俄罗斯天然气基础设施泄漏大幅减少，被认为是解释 1990 年代 CH₄「停滞期」的主流假说之一。',gasLabel:'CH₄'},
  {year:1998,gas:'co2',level:'A',title:'强厄尔尼诺与印尼泥炭火',desc:'1997–98 年强厄尔尼诺造成高温干旱，陆地碳汇减弱，加上印尼大规模泥炭地火灾，CO₂ 与 CH₄ 增长率同时飙升。',gasLabel:'CO₂ · CH₄'},
  {year:2001,gas:'ch4',level:'B',title:'CH₄ 增速停滞期',desc:'约 1999–2006 年，甲烷浓度几乎停止增长。原因至今未定：湿地排放变化、化石燃料泄漏减少、OH 浓度变化都在候选之列。',gasLabel:'CH₄'},
  {year:2009,gas:'co2',level:'B',title:'全球金融危机',desc:'化石燃料排放短暂下降，但大气 CO₂ 增速只是轻微放缓。首次直观演示「减排并不等于浓度下降」。',gasLabel:'CO₂'},
  {year:2015,gas:'co2',level:'C',title:'巴黎协定通过',desc:'重要的气候政策信号，但当年浓度曲线并无异常。用来讨论政策生效到大气响应之间存在的时间滞后。',gasLabel:'CO₂'},
  {year:2020,gas:'co2',level:'A',title:'COVID-19 疫情封锁',desc:'全球日排放下降约 4–5%，但大气 CO₂ 全年浓度仍继续上升。这是整条时间轴上最反直觉、也最有教育意义的一课。',gasLabel:'CO₂'}
];
function buildEventAxis(){
  const axis=$('#eventAxis');
  const g=D.gases[currentGas];
  const xMin=g.monthly[0][0], xMax=g.monthly[g.monthly.length-1][0];
  EVENTS.filter(e=>xMin<=e.year&&e.year<=xMax).forEach(e=>{
    const m=document.createElement('div');
    m.className='event-marker ev-'+e.level;
    m.style.left=((e.year-xMin)/(xMax-xMin)*100)+'%';
    m.innerHTML=`<span class="ev-tip">${e.year} · ${e.title}</span>`;
    m.onclick=()=>openEvent(e);
    axis.appendChild(m);
  });
}
function openEvent(e){
  $('#evYear').textContent=e.year;
  const lv=$('#evLevel');
  lv.textContent='证据等级 '+e.level+' · '+(e.level==='A'?'观测支持':e.level==='B'?'机制假说':'时间重合');
  lv.className='ev-level ev-lv-'+e.level;
  $('#evTitle').textContent=e.title;
  $('#evDesc').textContent=e.desc;
  $('#evGas').textContent='关联气体：'+e.gasLabel;
  $('#eventDetail').classList.add('show');
}
$('#eventClose').onclick=()=>$('#eventDetail').classList.remove('show');
$('#eventDetail').onclick=ev=>{if(ev.target.id==='eventDetail')ev.currentTarget.classList.remove('show')};
document.addEventListener('keydown',ev=>{if(ev.key==='Escape'){$('#eventDetail').classList.remove('show');$('#paperModal').classList.remove('show')}});

/* ---------- 双轨图 ---------- */
let dualChart=null, dualMode='fossil';
function renderDual(){
  const rows=D.growth.filter(r=>r.year>=1990);
  const bar=rows.map(r=>dualMode==='fossil'?r.fossil:r.incl_luc);
  const atm=rows.map(r=>r.dppm);
  const color=dualMode==='fossil'?'#2a8a5b':'#1b5e3f';
  const opts=baseOpts({
    scales:{
      x:{grid:{display:false},border:{display:false},ticks:{color:fontColor,maxTicksLimit:14,font:{size:10}}},
      y:{type:'linear',position:'left',grid:{color:gridColor},border:{display:false},ticks:{color:fontColor,font:{size:11}},title:{display:true,text:'排放 GtCO₂/年',color:fontColor,font:{size:11}}},
      y2:{type:'linear',position:'right',grid:{display:false},border:{display:false},ticks:{color:'#d9a441',font:{size:11}},title:{display:true,text:'大气增量 ppm/年',color:'#d9a441',font:{size:11}}}
    },
    plugins:{legend:{display:true,position:'top',align:'end',labels:{boxWidth:14,font:{size:11},color:fontColor}},
      tooltip:{backgroundColor:'#0b2a1e',cornerRadius:10,padding:12}}
  });
  if(dualChart){dualChart.destroy();}
  dualChart=new Chart($('#dualChart').getContext('2d'),{
    data:{labels:rows.map(r=>r.year),datasets:[
      {type:'bar',label:dualMode==='fossil'?'化石燃料排放':'排放（含土地利用）',data:bar,backgroundColor:color+'b0',borderRadius:4,yAxisID:'y',order:2},
      {type:'line',label:'大气 CO₂ 年增量',data:atm,borderColor:'#d9a441',backgroundColor:'#d9a441',borderWidth:2.5,pointRadius:0,pointHoverRadius:5,tension:.2,yAxisID:'y2',order:1}
    ]},options:opts});
}
$('#dualSeg').addEventListener('click',ev=>{
  if(!ev.target.dataset.mode)return;
  dualMode=ev.target.dataset.mode;
  $$('#dualSeg button').forEach(b=>b.classList.toggle('active',b===ev.target));
  renderDual();
});

/* ---------- 季节振幅趋势 ---------- */
function renderAmp(){
  const a=D.gases.co2.amplitude;
  const opts=baseOpts({
    plugins:{legend:{display:false},tooltip:{backgroundColor:'#0b2a1e',cornerRadius:10,padding:12}},
    scales:{
      x:{grid:{display:false},border:{display:false},ticks:{color:fontColor,maxTicksLimit:12,font:{size:10}}},
      y:{grid:{color:gridColor},border:{display:false},ticks:{color:fontColor,font:{size:11}},title:{display:true,text:'季节振幅 (ppm)',color:fontColor,font:{size:11}}}
    }
  });
  const ctx=$('#ampChart').getContext('2d');
  const grad=ctx.createLinearGradient(0,0,0,300);grad.addColorStop(0,'rgba(42,138,91,.35)');grad.addColorStop(1,'rgba(42,138,91,.02)');
  new Chart(ctx,{type:'line',data:{labels:a.map(p=>p[0]),datasets:[{data:a.map(p=>p[1]),borderColor:'#2a8a5b',borderWidth:2.5,pointRadius:0,pointHoverRadius:5,tension:.3,fill:true,backgroundColor:grad}]},options:opts});
}

/* ---------- 大气滞留比例 ---------- */
function renderAF(){
  const rows=D.growth.filter(r=>r.year>=1980);
  const opts=baseOpts({
    plugins:{legend:{display:false},tooltip:{backgroundColor:'#0b2a1e',cornerRadius:10,padding:12,callbacks:{label:it=>(it.parsed.y*100).toFixed(1)+'%'}}},
    scales:{
      x:{grid:{display:false},border:{display:false},ticks:{color:fontColor,maxTicksLimit:12,font:{size:10}}},
      y:{grid:{color:gridColor},border:{display:false},ticks:{color:fontColor,font:{size:11},callback:v=>(v*100).toFixed(0)+'%'},min:0,max:1,title:{display:true,text:'留在大气的比例',color:fontColor,font:{size:11}}}
    }
  });
  const ctx=$('#afChart').getContext('2d');
  new Chart(ctx,{type:'line',data:{labels:rows.map(r=>r.year),datasets:[
    {data:rows.map(r=>r.af_incl),borderColor:'#2a8a5b',borderWidth:2.5,pointRadius:0,pointHoverRadius:5,tension:.3,
     fill:true,backgroundColor:'rgba(42,138,91,.12)'},
    {data:rows.map(r=>r.af_fossil),borderColor:'#4a90c2',borderWidth:1.5,borderDash:[5,4],pointRadius:0,tension:.3,fill:false}
  ]},options:opts});
}

/* ---------- 碳汇实验室 ---------- */
const LAB = (function(){
  // 教学示意模型（非真实预测）：以全球陆地为尺度，GtC/年
  // 基准（工业化前 T=0,P=0,C=280）：GPP0=R0=120 → NEP≈0（平衡）
  const GPP0=120, R0=120, C0=280, T0=0;
  const Q10=2.0;            // 呼吸温度敏感性（Q10）
  const FERT=0.22;          // CO2 施肥系数（对数饱和）
  const P_GPP=0.0035, P_R=0.0015; // 降水对光合/呼吸的调节（干旱抑制光合更强）

  const state={temp:1.2, precip:0, co2:420};
  let curveChart=null;

  function gpp(t,p,c){
    const fert=1+FERT*Math.log(c/C0);
    const temp=Math.exp(t/50); // 升温对光合仅有温和促进（受养分、水分限制）
    const prec=1+P_GPP*p;
    return Math.max(0,GPP0*fert*temp*prec);
  }
  function resp(t,p,c){
    const q=Math.pow(Q10,(t-T0)/10);
    const prec=1+P_R*p;
    return Math.max(0,R0*q*prec);
  }
  function nep(t,p,c){return gpp(t,p,c)-resp(t,p,c);}

  function fmt(v,d){return (v>0?'+':'')+v.toFixed(d===undefined?1:d);}

  function render(){
    const {temp,precip,co2}=state;
    const G=gpp(temp,precip,co2), R=resp(temp,precip,co2), N=G-R;

    // 控制值
    $('#labTempVal').textContent='+'+temp.toFixed(1)+' °C';
    $('#labPrecipVal').textContent=(precip>0?'+':'')+precip+' %';
    $('#labCO2Val').textContent=co2+' ppm';

    // NEP 数字与徽章
    $('#nepValue').textContent=fmt(N,1);
    const badge=$('#nepBadge'), num=$('#nepValue');
    let status,cls,color;
    if(N>1){status='净碳汇 · 陆地在吸碳';cls='sink';color='var(--green-700)'}
    else if(N<-1){status='净碳源 · 陆地在排碳';cls='source';color='#c1503a'}
    else{status='接近平衡';cls='near';color='#9c731f'}
    badge.className='nep-badge '+cls;
    $('#nepStatus').textContent=status;
    num.style.color=color;

    // 拔河条（以 200 GtC 为满刻度）
    const MAX=200;
    $('#gppBar').style.width=Math.min(100,G/MAX*100)+'%';
    $('#respBar').style.width=Math.min(100,R/MAX*100)+'%';
    $('#gppVal').textContent=G.toFixed(0);
    $('#respVal').textContent=R.toFixed(0);

    // 指针：-30..+30 GtC 映射到 0..100%（覆盖演示量级，使翻转可见）
    const needle=$('#balanceNeedle');
    const pos=Math.max(2,Math.min(98,50+N/30*50));
    needle.style.left=pos+'%';
    needle.style.borderColor=color;

    // 解读文字
    const fertile=(1+FERT*Math.log(co2/C0)-1)*100;
    const gppWarm=(Math.exp(temp/50)-1)*100;
    const respBoost=(Math.pow(Q10,temp/10)-1)*100;
    const explain=$('#labExplain');
    let title,body,sourceMode=false;
    if(N>1){
      title='🌿 当前设定下：陆地仍是净碳汇';
      body=`CO₂ 升至 <strong>${co2} ppm</strong> 带来约 <strong>+${fertile.toFixed(0)}%</strong> 的施肥效应，加上升温对光合的小幅促进（+${gppWarm.toFixed(0)}%），光合吸收达到 ${G.toFixed(0)} GtC/年。同一轮升温 +${temp.toFixed(1)}°C 使呼吸按 Q10 规律加快约 <strong>${respBoost.toFixed(0)}%</strong%（释放 ${R.toFixed(0)} GtC/年）——它跑得比光合快，但施肥暂时补上了差距，陆地仍净吸收 <strong>${N.toFixed(1)} GtC/年</strong>。`;
    }else if(N<-1){
      sourceMode=true;
      title='🔥 当前设定下：陆地翻转为净碳源';
      body=`呼吸释放达到 <strong>${R.toFixed(0)} GtC/年</strong>，超过了光合的 ${G.toFixed(0)} GtC/年。升温 +${temp.toFixed(1)}°C 让呼吸按 Q10 加快约 <strong>${respBoost.toFixed(0)}%</strong>，而 CO₂ 施肥只让光合增长 ${fertile.toFixed(0)}%、升温的温和促进仅 ${gppWarm.toFixed(0)}%。呼吸这一侧跑赢了，净结果是向大气<strong>额外排放 ${Math.abs(N).toFixed(1)} GtC/年</strong>——这正是"碳汇饱和甚至反转"的担忧。`;
    }else{
      title='⚖️ 当前设定下：碳汇与碳源接近平衡';
      body=`光合吸收 ${G.toFixed(0)} 与呼吸释放 ${R.toFixed(0)} 几乎相抵，净通量仅 ${fmt(N,1)} GtC/年。系统正处在临界点附近：温度或降水稍有变化，就可能倒向碳汇或碳源。`;
    }
    explain.className='lab-explain'+(sourceMode?' source-mode':'');
    explain.innerHTML='<div class="ex-title">'+title+'</div>'+body;

    // 曲线上的当前点
    updateCurvePoint(temp,precip,co2,N);
  }

  function updateCurvePoint(temp,precip,co2,N){
    if(!curveChart)return;
    curveChart.data.datasets[1].data=[{x:temp,y:N}];
    curveChart.options.plugins.tooltip.callbacks.label=it=>
      '温度 +'+it.parsed.x.toFixed(1)+'°C · NEP '+fmt(it.parsed.y,1)+' GtC/年';
    curveChart.update('none');
  }

  function buildCurve(){
    const ts=[]; for(let t=0;t<=5.0001;t+=0.1)ts.push(+t.toFixed(1));
    const series=ts.map(t=>({x:t,y:nep(t,state.precip,state.co2)}));
    const opts={
      responsive:true,maintainAspectRatio:false,animation:{duration:600,easing:'easeOutQuart'},
      interaction:{mode:'nearest',intersect:false},
      plugins:{legend:{display:false},tooltip:{backgroundColor:'#0b2a1e',cornerRadius:10,padding:12,
        callbacks:{title:it=>'升温 +'+it[0].parsed.x.toFixed(1)+' °C',label:it=>'NEP '+fmt(it.parsed.y,1)+' GtC/年'}}},
      scales:{
        x:{type:'linear',min:0,max:5,grid:{color:gridColor},border:{display:false},
           ticks:{color:fontColor,font:{size:11},callback:v=>'+'+v+'°'}},
        y:{grid:{color:gridColor},border:{display:false},ticks:{color:fontColor,font:{size:11}},
           title:{display:true,text:'NEP (GtC/年)',color:fontColor,font:{size:11}}}
      },
      annotation:undefined
    };
    const ctx=$('#labChart').getContext('2d');
    const grad=ctx.createLinearGradient(0,0,0,230);
    grad.addColorStop(0,'rgba(42,138,91,.28)');grad.addColorStop(.5,'rgba(42,138,91,.04)');grad.addColorStop(1,'rgba(192,80,58,.20)');
    curveChart=new Chart(ctx,{type:'line',data:{datasets:[
      {data:series,borderColor:'#2a8a5b',borderWidth:2.5,pointRadius:0,tension:.25,fill:true,backgroundColor:grad},
      {data:[],borderColor:'#d9a441',backgroundColor:'#d9a441',pointRadius:7,pointHoverRadius:9,pointBorderColor:'#fff',pointBorderWidth:2,showLine:false}
    ]},options:opts});
  }

  function rebuildCurve(){
    if(!curveChart)return;
    const ts=[]; for(let t=0;t<=5.0001;t+=0.1)ts.push(+t.toFixed(1));
    curveChart.data.datasets[0].data=ts.map(t=>({x:t,y:nep(t,state.precip,state.co2)}));
    curveChart.update('none');
    render();
  }

  function setPreset(name){
    const P={
      pre:{temp:0,precip:0,co2:280},
      now:{temp:1.2,precip:0,co2:420},
      two:{temp:2.0,precip:0,co2:450},
      hot:{temp:4.0,precip:-35,co2:600}
    }[name];
    if(!P)return;
    state.temp=P.temp;state.precip=P.precip;state.co2=P.co2;
    $('#labTemp').value=P.temp;$('#labPrecip').value=P.precip;$('#labCO2').value=P.co2;
    $$('.preset-btns button').forEach(b=>b.classList.toggle('active',b.dataset.preset===name));
    rebuildCurve();
  }

  function init(){
    // 支持 URL 参数设定初始情景（深链，便于分享特定情景）
    const q=new URLSearchParams(location.search);
    if(q.has('lt'))state.temp=Math.max(0,Math.min(5,+q.get('lt')||0));
    if(q.has('lp'))state.precip=Math.max(-50,Math.min(30,+q.get('lp')||0));
    if(q.has('lc'))state.co2=Math.max(280,Math.min(700,+q.get('lc')||280));
    $('#labTemp').value=state.temp;$('#labPrecip').value=state.precip;$('#labCO2').value=state.co2;
    buildCurve();
    $('#labTemp').addEventListener('input',e=>{state.temp=+e.target.value;$$('.preset-btns button').forEach(b=>b.classList.remove('active'));render()});
    $('#labPrecip').addEventListener('input',e=>{state.precip=+e.target.value;$$('.preset-btns button').forEach(b=>b.classList.remove('active'));rebuildCurve()});
    $('#labCO2').addEventListener('input',e=>{state.co2=+e.target.value;$$('.preset-btns button').forEach(b=>b.classList.remove('active'));rebuildCurve()});
    $('#labReset').addEventListener('click',()=>setPreset('now'));
    $$('.preset-btns button').forEach(b=>b.addEventListener('click',()=>setPreset(b.dataset.preset)));
    render();
  }
  return {init};
})();

/* ---------- 论文弹层 ---------- */
$('#keelingBubble').addEventListener('click',()=>$('#paperModal').classList.add('show'));
$('#paperClose').onclick=()=>$('#paperModal').classList.remove('show');
$('#paperModal').onclick=ev=>{if(ev.target.id==='paperModal')ev.currentTarget.classList.remove('show')};

/* ---------- 滚动显现 & 导航 ---------- */
function initReveal(){
  const els=$$('.reveal,.gas-card,.panel');
  // 静态兜底：无 IntersectionObserver 或 ?static=1 时直接显示，避免内容不可见
  if(new URLSearchParams(location.search).has('static') || !('IntersectionObserver' in window)){
    els.forEach(el=>el.classList.add('in')); return;
  }
  const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target)}}),{threshold:.12});
  els.forEach(el=>io.observe(el));
}
function initNav(){
  const nav=$('#nav');
  window.addEventListener('scroll',()=>nav.classList.toggle('scrolled',window.scrollY>60));
  $('#exploreBtn').onclick=()=>$('#overview').scrollIntoView({behavior:'smooth'});
}

/* ---------- 初始化 ---------- */
function init(){
  buildGasCards();
  buildGasToggle();
  renderMain();
  buildEventAxis();
  renderDual();
  renderAmp();
  renderAF();
  LAB.init();
  initReveal();
  initNav();
  // 卡片点击切换气体
  $$('.gas-card').forEach(c=>c.onclick=()=>{setGas(c.dataset.gas);$('#timeline').scrollIntoView({behavior:'smooth',block:'center'})});
  let rt; window.addEventListener('resize',()=>{clearTimeout(rt);rt=setTimeout(()=>{placeKeelingBubble();},150)});
  // 便于深链/验证：?scroll=区块id 直接定位
  const qs=new URLSearchParams(location.search);
  const sc=qs.get('scroll');
  if(sc){
    document.documentElement.style.scrollBehavior='auto';
    const el=document.getElementById(sc);
    if(el)setTimeout(()=>window.scrollTo(0,el.getBoundingClientRect().top+window.pageYOffset-10),400);
  }
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
