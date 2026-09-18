import { connect } from './cdp.mjs';
const c = await connect();
const j = async (e) => JSON.parse(await c.evaluate(`JSON.stringify(${e})`));
const md = () => j(`(() => { const el=document.querySelector('.workspace-leaf-content[data-type="markdown"] .reading-ruler-overlay'); const r=el.querySelector('.reading-ruler-band').getBoundingClientRect(); const hEl=el.querySelector('.reading-ruler-handle'); const hr=hEl.getBoundingClientRect(); const host=el.parentElement.getBoundingClientRect(); return {cls:el.className.replace('reading-ruler-overlay','').trim(), bandCentre:Math.round(r.top+r.height/2), handleDisplay:getComputedStyle(hEl).display, handle:[Math.round(hr.left),Math.round(hr.top),Math.round(hr.width),Math.round(hr.height)], host:[Math.round(host.left),Math.round(host.top),Math.round(host.width),Math.round(host.height)]}; })()`);
await c.evaluate(`app.commands.executeCommandById('editor:close-search')`).catch(()=>{});
await c.evaluate(`(() => { document.querySelector('.document-search-close-button')?.click(); const l=app.workspace.getLeavesOfType('markdown')[0]; app.workspace.setActiveLeaf(l,{focus:true}); l.view.editor.focus(); })()`);
await c.sleep(300);
const touch = (type, x, y) => c.send('Input.dispatchTouchEvent', { type, touchPoints: type==='touchEnd' ? [] : [{ x, y, id: 1 }] });
// 1. touch inside the note -> fixed mode + handle
await touch('touchStart', 500, 500); await touch('touchEnd'); await c.sleep(300);
const s1 = await md(); console.log('after touch   :', JSON.stringify(s1), ' expected centre', Math.round(s1.host[1] + 0.35*s1.host[3]));
const focusBefore = await c.evaluate(`document.activeElement.className`);
// 2. drag the handle down 150px
const hx = s1.handle[0] + s1.handle[2] - 8, hy = s1.handle[1] + s1.handle[3]/2;
console.log('hit-test handle:', await c.evaluate(`document.elementFromPoint(${hx},${hy}).className`));
await touch('touchStart', hx, hy); for (let i=1;i<=5;i++) { await touch('touchMove', hx, hy + i*30); await c.sleep(30); } await touch('touchEnd'); await c.sleep(900);
const s2 = await md(); console.log('after drag    :', JSON.stringify({bandCentre:s2.bandCentre, cls:s2.cls}), ' expected centre ~', Math.round(hy+150));
console.log('focus kept    :', focusBefore, '->', await c.evaluate(`document.activeElement.className`));
console.log('other overlay :', JSON.stringify(await j(`(() => { const el=document.querySelector('.workspace-leaf-content[data-type="pdf"] .reading-ruler-overlay'); const r=el.querySelector('.reading-ruler-band').getBoundingClientRect(); const h=el.parentElement.getBoundingClientRect(); return {fractionShown: +((r.top+r.height/2-h.top)/h.height).toFixed(3)}; })()`)));
console.log('saved fraction:', JSON.parse(await c.evaluate(`app.vault.adapter.read('.obsidian/plugins/reading-ruler/data.json')`)).fixedFraction);
// 3. pinned hides handle
await c.evaluate(`app.commands.executeCommandById('reading-ruler:toggle-pin')`); await c.sleep(150);
console.log('pinned handle :', (await md()).handleDisplay);
await c.evaluate(`app.commands.executeCommandById('reading-ruler:toggle-pin')`); await c.sleep(150);
// 4. mouse takes over again
await c.mouse('mouseMoved', 500, 300); await c.mouse('mouseMoved', 500, 330); await c.sleep(200);
const s3 = await md(); console.log('mouse again   :', JSON.stringify({bandCentre:s3.bandCentre, handle:s3.handleDisplay, cls:s3.cls}));
// 5. caret following
await c.evaluate(`(() => { const p=app.plugins.plugins['reading-ruler']; app.setting; })()`);
const setFollow = (v) => c.evaluate(`(() => { const tab=app.setting.pluginTabs.find(t=>t.id==='reading-ruler'); tab.setControlValue('followCaret', ${v}); })()`);
const caretInfo = () => j(`(() => { const v=app.workspace.getLeavesOfType('markdown')[0].view; const cm=v.editor.cm; const co=cm.coordsAtPos(cm.state.selection.main.head); return {caretMid: Math.round((co.top+co.bottom)/2)}; })()`);
const moveCaret = (line) => c.evaluate(`(() => { const e=app.workspace.getLeavesOfType('markdown')[0].view.editor; e.setCursor({line:${line}, ch:3}); })()`);
await moveCaret(8); await c.sleep(300);
console.log('caret, setting off:', JSON.stringify({band:(await md()).bandCentre, ...(await caretInfo())}));
await setFollow(true); await moveCaret(12); await c.sleep(300);
console.log('caret, setting on :', JSON.stringify({band:(await md()).bandCentre, ...(await caretInfo())}));
await c.send('Input.insertText', { text: 'typed ' }); await c.sleep(300);
console.log('after typing      :', JSON.stringify({band:(await md()).bandCentre, ...(await caretInfo())}), 'sel head unchanged by plugin');
await c.mouse('mouseMoved', 500, 600); await c.mouse('mouseMoved', 500, 640); await c.sleep(200);
console.log('mouse wins        :', (await md()).bandCentre);
await c.evaluate(`app.workspace.getLeavesOfType('markdown')[0].view.editor.undo()`);
await setFollow(false);
c.close();
