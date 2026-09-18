import { connect } from './cdp.mjs';
const c = await connect();
const tab = `app.setting.pluginTabs.find(t=>t.id==='reading-ruler')`;
const set = (k, v) => c.evaluate(`${tab}.setControlValue('${k}', ${JSON.stringify(v)})`);
await c.evaluate(`app.setting.close()`);
await set('fullWidth', false); await set('widthPercent', 50); await set('tintPreset', 'yellow'); await set('tintStrength', 30); await set('dimStrength', 70); await set('bandHeight', 90);
const band = () => c.evaluate(`JSON.stringify((() => { const b=document.querySelector('.workspace-leaf-content[data-type="markdown"] .reading-ruler-band'); const r=b.getBoundingClientRect(); const cs=getComputedStyle(b); return {l:Math.round(r.left), w:Math.round(r.width), h:Math.round(r.height), bg:cs.backgroundColor, shadow:cs.boxShadow.slice(0,28)}; })())`);
await c.mouse('mouseMoved', 600, 380); await c.mouse('mouseMoved', 684, 400); await c.sleep(200);
console.log('custom width centre :', await band(), '(host 344..1024, expect l=514 w=340)');
await c.mouse('mouseMoved', 350, 400); await c.sleep(200);
console.log('custom width left   :', await band(), '(expect l=344)');
await c.mouse('mouseMoved', 1015, 400); await c.sleep(200);
console.log('custom width right  :', await band(), '(expect l=684)');
await c.mouse('mouseMoved', 700, 420); await c.sleep(200);
await c.screenshot('shot-13-custom.png');
// clamping through the settings path
await set('bandHeight', 5000); console.log('clamped bandHeight  :', await c.evaluate(`${tab}.getControlValue('bandHeight')`));
// legacy display() fallback
console.log('legacy display rows :', await c.evaluate(`(() => { const t=${tab}; t.display(); const names=[...t.containerEl.querySelectorAll('.setting-item-name')].map(e=>e.innerText); const sliders=t.containerEl.querySelectorAll('input[type=range]').length; const toggles=t.containerEl.querySelectorAll('.checkbox-container').length; return JSON.stringify({names, sliders, toggles, selects:t.containerEl.querySelectorAll('select').length, colors:t.containerEl.querySelectorAll('input[type=color]').length}); })()`));
for (const [k,v] of Object.entries({fullWidth:true, widthPercent:100, tintStrength:0, dimStrength:50, bandHeight:60})) await set(k, v);
await c.sleep(800);
console.log('restored data.json  :', (await c.evaluate(`app.vault.adapter.read('.obsidian/plugins/reading-ruler/data.json')`)).replace(/\s+/g,' '));
c.close();
