import { connect } from './cdp.mjs';
const c = await connect();
const j = async (e) => JSON.parse(await c.evaluate(`JSON.stringify(${e})`));
const scrollListeners = async () => {
	const { result } = await c.send('Runtime.evaluate', { expression: `app.workspace.getLeavesOfType('markdown')[0].view.editor.cm.scrollDOM` });
	const { listeners } = await c.send('DOMDebugger.getEventListeners', { objectId: result.objectId });
	return listeners.filter((l) => l.type === 'scroll').length;
};
const tab = `app.setting.pluginTabs.find(t=>t.id==='reading-ruler')`;
const base = await scrollListeners();
await c.evaluate(`${tab}.setControlValue('followCaret', true)`); const on = await scrollListeners();
await c.evaluate(`app.commands.executeCommandById('reading-ruler:toggle-pin')`); const pinned = await scrollListeners();
await c.evaluate(`app.commands.executeCommandById('reading-ruler:toggle-pin')`);
console.log('scroll listeners on editor: followCaret off =', base, '| on =', on, '| on+pinned =', pinned);
// mouse mode + wheel scroll must not jump to caret
await c.mouse('mouseMoved', 500, 300); await c.mouse('mouseMoved', 500, 350); await c.sleep(150);
await c.send('Input.dispatchMouseEvent', { type:'mouseWheel', x:500, y:350, deltaX:0, deltaY:600 }); await c.sleep(400);
console.log('mouse mode after wheel scroll, band centre (expect 350):', await c.evaluate(`(() => { const r=rrBand('.workspace-leaf-content[data-type="markdown"]'); return Math.round(r.top+r.height/2); })()`));
await c.evaluate(`${tab}.setControlValue('followCaret', false)`);
// popout
await c.evaluate(`(async()=>{ const l=app.workspace.getLeavesOfType('pdf')[0]; app.workspace.moveLeafToPopout(l); await new Promise(r=>setTimeout(r,2500)); })()`);
console.log('after popout:', JSON.stringify(await j(`(() => { const out=[]; app.workspace.iterateAllLeaves(l=>{ const el=l.view.containerEl; const o=el.querySelector('.reading-ruler-overlay'); if(!o) return; const r=rrBand(o === document ? undefined : o); const h=o.parentElement.getBoundingClientRect(); out.push({type:l.view.getViewType(), sameDoc: el.ownerDocument===document, enabled:o.classList.contains('is-enabled'), bandW:Math.round(r.width), hostW:Math.round(h.width), frac:+((r.top+r.height/2-h.top)/h.height).toFixed(3)}); }); return out; })()`)));
c.close();
// drive the popout window itself
const p = await connect((t) => t.type === 'page' && t.url === 'about:blank');
const pj = async (e) => JSON.parse(await p.evaluate(`JSON.stringify(${e})`));
const host = await pj(`(() => { const h=document.querySelector('.reading-ruler-host').getBoundingClientRect(); return [h.left,h.top,h.width,h.height].map(Math.round); })()`);
const px = host[0]+host[2]/2, py = host[1]+260;
await p.mouse('mouseMoved', px, py-20); await p.mouse('mouseMoved', px, py); await p.sleep(300);
console.log('popout follow:', JSON.stringify(await pj(`(() => { const r=rrBand(document === document ? undefined : document); return {centre:Math.round(r.top+r.height/2), w:Math.round(r.width)}; })()`)), 'expected centre', py);
await p.send('Emulation.setDeviceMetricsOverride', { width: 700, height: 500, deviceScaleFactor: 0, mobile: false }).catch(()=>{});
await p.screenshot('shot-09-popout.png');
p.close();
