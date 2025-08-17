(function(){
  const $=s=>document.querySelector(s);
  const file=$('#file'), analyzeBtn=$('#analyze'), tickets=$('#tickets'), status=$('#status'), state=$('#state');
  const axis=$('#axisSide'), lastPriceEl=$('#lastPrice'); const copyBtn=$('#copy');
  const canvas=document.createElement('canvas'); canvas.width=1400; canvas.height=900; const ctx=canvas.getContext('2d');
  let images=[], lastPlain='';

  setInterval(()=>{const d=new Date(); document.querySelector('#clock').textContent=d.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})},1000);

  file.addEventListener('change', async (e)=>{ images=[]; for(const f of e.target.files){ const u=URL.createObjectURL(f); const im=new Image(); im.src=u; await im.decode(); images.push(im);} status.textContent=`Loaded ${images.length} image(s).`; });

  function avg(x0,y0,w,h){const d=ctx.getImageData(x0,y0,w,h).data;let r=0,g=0,b=0,n=0;for(let i=0;i<d.length;i+=4){r+=d[i];g+=d[i+1];b+=d[i+2];n++;}return[r/n,g/n,b/n];}
  const dist=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]);
  function drawFit(img){const sc=Math.min(canvas.width/img.width,canvas.height/img.height);const w=img.width*sc,h=img.height*sc,x=(canvas.width-w)/2,y=(canvas.height-h)/2;ctx.clearRect(0,0,canvas.width,canvas.height);ctx.fillStyle='#0b0f14';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(img,x,y,w,h);return {x,y,w,h};}
  function sampleStrip(rect){const {x,y,w,h}=rect,step=Math.max(2,Math.floor(w/240));const H=[],L=[],C=[];const bg=avg(x,y,w,Math.min(20,h));
    for(let xi=x;xi<x+w;xi+=step){let hi=null,lo=null; for(let yi=y;yi<y+h;yi++){const p=ctx.getImageData(xi,yi,1,1).data;if(dist([p[0],p[1],p[2]],bg)>30){hi=yi;break;}}
      for(let yi=y+h-1;yi>=y;yi--){const p=ctx.getImageData(xi,yi,1,1).data;if(dist([p[0],p[1],p[2]],bg)>30){lo=yi;break;}} if(hi==null||lo==null) continue; const closeY=lo-Math.min(5,lo-y); H.push(hi);L.push(lo);C.push(closeY);} return {H,L,C};}

  function sma(a,p){const o=[];let s=0;for(let i=0;i<a.length;i++){s+=a[i];if(i>=p)s-=a[i-p];o.push(i>=p-1?s/p:a[i]);}return o;}
  function ema(a,p){const k=2/(p+1);const o=[];let e=a[0];for(let i=0;i<a.length;i++){e=i?(a[i]*k+e*(1-k)):a[0];o.push(e);}return o;}
  function rsi(cl,p=14){let g=[],l=[];for(let i=1;i<cl.length;i++){const d=cl[i]-cl[i-1];g.push(Math.max(0,d));l.push(Math.max(0,-d));}g=sma(g,p);l=sma(l,p);const o=[50];for(let i=1;i<cl.length;i++){const rs=(g[i-1]||1e-6)/(l[i-1]||1e-6);o.push(100-100/(1+rs));}return o;}
  function macd(cl,a=12,b=26,s=9){const e1=ema(cl,a),e2=ema(cl,b);const m=e1.map((v,i)=>v-(e2[i]||v));const sig=ema(m,s);return {hist:m.map((v,i)=>v-(sig[i]||0))};}
  function boll(cl,p=20,k=2){const m=sma(cl,p),o=[];for(let i=0;i<cl.length;i++){const a=Math.max(0,i-p+1),sl=cl.slice(a,i+1),u=m[i],sd=Math.sqrt(sl.reduce((s,v)=>s+(v-u)*(v-u),0)/Math.max(1,sl.length));o.push({bw:(k*sd)/(u||1)});}return o;}
  function linreg(x,y){const n=x.length,sx=x.reduce((a,b)=>a+b,0),sy=y.reduce((a,b)=>a+b,0),sxx=x.reduce((a,b)=>a+b*b,0),sxy=x.reduce((a,b,i)=>a+b*y[i],0);const d=n*sxx-sx*sx||1e-6;const m=(n*sxy-sx*sy)/d;const b=(sy-m*sx)/n;return {m,b};}

  function analyzeImage(img){
    const fit=drawFit(img); const wStrip=Math.round(fit.w*0.12); const sx=(axis.value==='right')?fit.x+fit.w-wStrip:fit.x; const region={x:sx,y:fit.y,w:wStrip,h:fit.h};
    const s=sampleStrip(region);
    const sc=100/(s.C.at(-1)||100); const cl=s.C.map(v=>v*sc), hi=s.H.map(v=>v*sc), lo=s.L.map(v=>v*sc);
    const ATRrel=(function(H,L,C,p=14){const tr=[];for(let i=0;i<H.length;i++){if(i===0){tr.push(H[i]-L[i]);}else{tr.push(Math.max(H[i]-L[i],Math.abs(H[i]-(C[i-1]||C[i])),Math.abs(L[i]-(C[i-1]||C[i])));}}return sma(tr,p).at(-1)||2;})(hi,lo,cl);
    const RSI=rsi(cl,14).at(-1)||50, MACD=macd(cl).hist.at(-1)||0, BB=boll(cl).at(-1).bw||0.02;
    const X=[...Array(cl.length).keys()], {m}=linreg(X,cl); const trend=m>0?'Up':(m<0?'Down':'Sideways');
    const anchor=parseFloat(lastPriceEl.value||'0'); const last = anchor>0? anchor : 0;
    return {atr:Math.max(0.5,Math.min(12,(ATRrel/2)*4.0)), last, rsi:RSI, macdh:MACD, bb:BB, trend, anchored: anchor>0};
  }

  function confluence(M){ let s=60; if(M.bb<0.015) s+=8; if(M.trend==='Up' && M.rsi>52 && M.macdh>0) s+=12; if(M.trend==='Down' && M.rsi<48 && M.macdh<0) s+=12; if(M.rsi>55 || M.rsi<45) s+=6; return Math.max(0,Math.min(100,Math.round(s)));}
  function wins24(M){ const now=new Date(); const tz=Intl.DateTimeFormat().resolvedOptions().timeZone;
    function at(tzid,hm){const [H,MM]=hm.split(':'), base=new Date(now.toLocaleString('en-US',{timeZone:tzid})); base.setHours(+H,+MM,0,0); return new Date(base.toLocaleString('en-US',{timeZone:tz}));}
    const defs=[['London Open','Europe/London','08:00',120,'Breakout'],['US 08:30 Data','America/New_York','08:30',60,'Breakout'],['COMEX Open','America/New_York','08:20',25,'Breakout'],['NYSE Open','America/New_York','09:30',60,'Breakout'],['LBMA AM Fix','Europe/London','10:30',20,'Situational'],['LBMA PM Fix','Europe/London','15:00',25,'Situational'],['London Close','Europe/London','16:00',60,'Mean-reversion'],['Asia Pulse','Asia/Tokyo','09:00',60,'Mean-reversion']];
    const base=confluence(M), out=[]; defs.forEach(d=>{const s=at(d[1],d[2]), e=new Date(s.getTime()+d[3]*60000); for(let t=new Date(s.getTime()-600000); t<new Date(e.getTime()+600000); t=new Date(t.getTime()+600000)){ let dir='Wait'; if(d[4]==='Breakout'&&M.trend==='Up'&&M.rsi>52&&M.macdh>0) dir='LONG'; if(d[4]==='Breakout'&&M.trend==='Down'&&M.rsi<48&&M.macdh<0) dir='SHORT'; if(d[4]==='Mean-reversion') dir='Fade'; const score=Math.max(0,Math.min(100,Math.round(base+(d[4]==='Breakout'?+6:-2)))); const P=Math.max(5,Math.min(95,Math.round(30+(score-50)*0.7))); out.push({label:d[0],bias:d[4],time:t,end:new Date(t.getTime()+600000),dir,score,P}); }}); return out.sort((a,b)=>a.time-b.time); }
  function prices(M, dir){ const atr=M.atr||2, ref=M.last||0, band=atr*0.03; if(dir==='LONG'){ const base=ref+0.25*atr; return {entryL:base-band/2,entryH:base+band/2,sl:base-1.0*atr,tp1:base+0.8*atr,tp2:base+1.6*atr,tp3:base+2.4*atr}; } if(dir==='SHORT'){ const base=ref-0.25*atr; return {entryL:base-band/2,entryH:base+band/2,sl:base+1.0*atr,tp1:base-0.8*atr,tp2:base-1.6*atr,tp3:base-2.4*atr}; } const base=ref; return {entryL:base-0.1*atr,entryH:base+0.1*atr,sl:base+1.0*atr,tp1:base-0.8*atr,tp2:base-1.6*atr,tp3:base-2.4*atr}; }
  const fmt=v=> (v>0? v.toFixed(2):'∼');

  function render(M, wins){ $('#kTrend').textContent=M.trend; $('#kATR').textContent=(M.atr||0).toFixed(2); $('#kRSI').textContent=(M.rsi||0).toFixed(0); $('#kMACD').textContent=(M.macdh||0).toFixed(2); $('#kBB').textContent=((M.bb||0)*100).toFixed(1)+'%'; tickets.innerHTML=''; const now=new Date(); const lines=[];
    wins.forEach(w=>{ const p=prices(M,w.dir); const el=document.createElement('div'); el.className='ticket'; el.innerHTML=`<div class="dir"><b class="${w.dir==='LONG'?'long':w.dir==='SHORT'?'short':'fade'}">${w.dir}</b> • ${w.label} • ${w.time.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}–${w.end.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})} <span class="mut">Score ${w.score} • P≈${w.P}%</span></div>
      <div class="pricebox">
        <div class="cell"><div class="k">Entry</div><div class="v">${fmt(p.entryL)}–${fmt(p.entryH)}</div></div>
        <div class="cell"><div class="k">TP1</div><div class="v">${fmt(p.tp1)}</div></div>
        <div class="cell"><div class="k">TP2</div><div class="v">${fmt(p.tp2)}</div></div>
        <div class="cell"><div class="k">TP3</div><div class="v">${fmt(p.tp3)}</div></div>
        <div class="cell" style="grid-column:1 / -1"><div class="k">Stop</div><div class="v">${fmt(p.sl)}</div></div>
      </div>`; tickets.appendChild(el);
      lines.push(`${w.time.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}-${w.end.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})} • ${w.dir} • ${w.label} • Entry ${fmt(p.entryL)}–${fmt(p.entryH)} • TP1 ${fmt(p.tp1)} • TP2 ${fmt(p.tp2)} • TP3 ${fmt(p.tp3)} • SL ${fmt(p.sl)} • Score ${w.score} • P≈${w.P}%`);
    }); lastPlain=lines.join('\\n'); }

  async function run(){ if(images.length===0){ status.textContent='Choose PNG/JPG first.'; return; } state.textContent='Analyzing…'; try{ let M=null; for(const im of images){ M=analyzeImage(im); } const wins=wins24(M); render(M,wins); status.textContent=`${M.anchored?'Absolute prices anchored':'Relative mode (enter Last price for exact levels)'}. Trend ${M.trend}, ATR≈$${(M.atr||0).toFixed(2)}, RSI≈${(M.rsi||0).toFixed(0)}, MACD≈${(M.macdh||0).toFixed(2)}, BB≈${((M.bb||0)*100).toFixed(1)}%`; state.textContent='Signals ready.'; }catch(e){ status.textContent='Error: '+e.message; state.textContent='Error'; } }
  analyzeBtn.addEventListener('click', run);
  copyBtn.addEventListener('click', async()=>{ try{ await navigator.clipboard.writeText(lastPlain||''); copyBtn.textContent='Copied ✓'; setTimeout(()=>copyBtn.textContent='Copy',1200);}catch(e){} });
})();