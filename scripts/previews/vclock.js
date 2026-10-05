// Virtual clock for frame-exact captures: once started, time only advances on tick(), and the page's
// requestAnimationFrame callbacks run once per tick.
(()=>{const rn=performance.now.bind(performance),rd=Date.now,rraf=window.requestAnimationFrame.bind(window);
let on=false,vt=0,base=0,q=[];
performance.now=()=>on?vt:rn();Date.now=()=>on?Math.round(base+vt):rd();
window.requestAnimationFrame=cb=>{if(on){q.push(cb);return q.length;}return rraf(cb);};
window.__vclock={start(){vt=rn();base=rd()-vt;on=true;},tick(ms){vt+=ms;const run=q;q=[];for(const cb of run){try{cb(vt);}catch(e){console.error(e);}}return run.length;},get now(){return vt;}};
})();
