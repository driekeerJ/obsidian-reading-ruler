import { connect } from './cdp.mjs';
const which = process.argv[2] ?? 'main';
const c = await connect(which === 'main' ? undefined : (t) => t.type === 'page' && t.url === 'about:blank');
await c.send('Performance.enable');
const metrics = async () => Object.fromEntries((await c.send('Performance.getMetrics')).metrics.map((m) => [m.name, m.value]));
const host = JSON.parse(await c.evaluate(`JSON.stringify((() => { const h=document.querySelector('.reading-ruler-host').getBoundingClientRect(); return [h.left,h.top,h.width,h.height]; })())`));
const x = host[0] + host[2]/2, top = host[1];
const frames = (ms) => c.evaluate(`new Promise(res => { const d=[]; let last=performance.now(); const end=last+${ms}; const tick=(t)=>{ d.push(t-last); last=t; t<end?requestAnimationFrame(tick):res(JSON.stringify({n:d.length, avg:+(d.reduce((a,b)=>a+b,0)/d.length).toFixed(2), p95:+d.sort((a,b)=>a-b)[Math.floor(d.length*0.95)].toFixed(2), max:+Math.max(...d).toFixed(2), over20:d.filter(v=>v>20).length})); }; requestAnimationFrame(tick); })`);
const setEnabled = async (on) => { const cur = await c.evaluate(`!!document.querySelector('.reading-ruler-overlay.is-enabled')`); if (cur !== on) { await c.evaluate(`app.commands.executeCommandById('reading-ruler:toggle')`); await c.sleep(400); } };
async function moveMouse(ms) { const t0=Date.now(); let i=0; while (Date.now()-t0<ms) { await c.mouse('mouseMoved', x + (i%7), top + 80 + (i*7)%(host[3]-160)); i++; } return i; }
async function wheel(ms) { const t0=Date.now(); let i=0; while (Date.now()-t0<ms) { await c.send('Input.dispatchMouseEvent', { type:'mouseWheel', x, y: top+300, deltaX:0, deltaY: (Math.floor(i/40)%2?-1:1)*120 }); i++; } return i; }
for (const on of [false, true]) {
	await setEnabled(on);
	await c.mouse('mouseMoved', x, top + 100); await c.sleep(200);
	let m0 = await metrics(); let f = frames(2000); const moves = await moveMouse(2000); const fr = JSON.parse(await f); let m1 = await metrics();
	console.log(`[${which}] ruler ${on?'ON ':'OFF'} mouse-follow: events=${moves} frames=${JSON.stringify(fr)} layouts=${m1.LayoutCount-m0.LayoutCount} styleRecalcs=${m1.RecalcStyleCount-m0.RecalcStyleCount} layoutMs=${((m1.LayoutDuration-m0.LayoutDuration)*1000).toFixed(1)} styleMs=${((m1.RecalcStyleDuration-m0.RecalcStyleDuration)*1000).toFixed(1)}`);
	m0 = await metrics(); f = frames(3000); const wheels = await wheel(3000); const fr2 = JSON.parse(await f); m1 = await metrics();
	console.log(`[${which}] ruler ${on?'ON ':'OFF'} wheel-scroll : events=${wheels} frames=${JSON.stringify(fr2)} layouts=${m1.LayoutCount-m0.LayoutCount} layoutMs=${((m1.LayoutDuration-m0.LayoutDuration)*1000).toFixed(1)} scriptMs=${((m1.ScriptDuration-m0.ScriptDuration)*1000).toFixed(1)}`);
}
c.close();
