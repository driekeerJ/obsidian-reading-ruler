import { connect } from './cdp.mjs';
const c = await connect();
const j = async (e) => JSON.parse(await c.evaluate(`JSON.stringify(${e})`));
await c.evaluate(`(async()=>{ await app.plugins.disablePlugin('reading-ruler'); await app.plugins.enablePlugin('reading-ruler'); await new Promise(r=>setTimeout(r,600)); const l=app.workspace.getLeavesOfType('markdown')[0]; app.workspace.setActiveLeaf(l,{focus:true}); l.view.editor.focus(); app.setting.pluginTabs.find(t=>t.id==='reading-ruler').setControlValue('followCaret', true); })()`);
const info = () => j(`(() => { const el=document.querySelector('.workspace-leaf-content[data-type="markdown"] .reading-ruler-overlay'); const r=rrBand(el === document ? undefined : el); const cm=app.workspace.getLeavesOfType('markdown')[0].view.editor.cm; const co=cm.coordsAtPos(cm.state.selection.main.head); return {band:Math.round(r.top+r.height/2), caret:Math.round((co.top+co.bottom)/2), head: cm.state.selection.main.head}; })()`);
for (const line of [40, 200, 6, 120]) {
	await c.evaluate(`app.workspace.getLeavesOfType('markdown')[0].view.editor.setCursor({line:${line}, ch:2})`); await c.sleep(350);
	console.log('jump to line', line, JSON.stringify(await info()));
}
await c.send('Input.dispatchKeyEvent', { type:'keyDown', key:'ArrowDown', code:'ArrowDown', windowsVirtualKeyCode:40 }); await c.send('Input.dispatchKeyEvent', { type:'keyUp', key:'ArrowDown', code:'ArrowDown', windowsVirtualKeyCode:40 }); await c.sleep(300);
console.log('arrow down   ', JSON.stringify(await info()));
await c.evaluate(`app.setting.pluginTabs.find(t=>t.id==='reading-ruler').setControlValue('followCaret', false)`);
c.close();
