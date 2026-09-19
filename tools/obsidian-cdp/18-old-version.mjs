// Smoke test for an Obsidian version older than 1.13.0: plugin loads, ruler works, legacy settings tab renders.
import { connect } from './cdp.mjs';
const c = await connect();
const trust = await c.evaluate(`(() => { const b=[...document.querySelectorAll('.modal-container button')].find(x=>/trust/i.test(x.innerText)&&!/don|restricted/i.test(x.innerText)); b?.click(); return !!b; })()`);
if (trust) await c.sleep(2500);
await c.evaluate(`document.querySelectorAll('.modal-container .modal-close-button').forEach(b=>b.click())`);
console.log('app version        :', await c.evaluate(`require('electron').ipcRenderer.sendSync('version')`), '| chrome', await c.evaluate(`process.versions.chrome`));
console.log('plugin loaded      :', await c.evaluate(`Object.keys(app.plugins.plugins).join(',')`));
console.log('has declarative API:', await c.evaluate(`(() => { const t=app.setting.pluginTabs.find(t=>t.id==='reading-ruler'); const proto=Object.getPrototypeOf(Object.getPrototypeOf(t)); return typeof proto.getSettingDefinitions; })()`), '(expect undefined on < 1.13)');
await c.evaluate(`(async()=>{ const t=app.setting.pluginTabs.find(t=>t.id==='reading-ruler'); t.setControlValue('enabled', true); t.setControlValue('bandHeight', 60); t.setControlValue('fixedPercent', 35); await new Promise(r=>setTimeout(r,500)); })()`);
const host = JSON.parse(await c.evaluate(`JSON.stringify((() => { const h=document.querySelector('.reading-ruler-host').getBoundingClientRect(); return [h.left,h.top,h.width,h.height]; })())`));
await c.mouse('mouseMoved', host[0]+host[2]/2, host[1]+200); await c.mouse('mouseMoved', host[0]+host[2]/2, host[1]+300); await c.sleep(250);
console.log('band follows mouse :', await c.evaluate(`JSON.stringify((() => { const r=rrBand(); return {centre:Math.round(r.top+r.height/2), h:Math.round(r.height), w:Math.round(r.width)}; })())`), 'expected centre', Math.round(host[1]+300));
console.log('click-through      :', await c.evaluate(`(() => { const e=document.elementFromPoint(${host[0]+host[2]/2}, ${host[1]+300}); return !e.closest('.reading-ruler-overlay'); })()`));
// open the settings the way a user does: Obsidian itself calls display()
await c.evaluate(`(async()=>{ app.setting.open(); app.setting.openTabById('reading-ruler'); await new Promise(r=>setTimeout(r,800)); })()`);
console.log('settings (by app)  :', await c.evaluate(`JSON.stringify((() => { const el=app.setting.pluginTabs.find(t=>t.id==='reading-ruler').containerEl; return {names:[...el.querySelectorAll('.setting-item-name')].map(e=>e.innerText), sliders:el.querySelectorAll('input[type=range]').length, toggles:el.querySelectorAll('.checkbox-container').length}; })())`));
// change a value through the real UI control
await c.evaluate(`(() => { const el=app.setting.pluginTabs.find(t=>t.id==='reading-ruler').containerEl; const row=[...el.querySelectorAll('.setting-item')].find(e=>e.querySelector('.setting-item-name')?.innerText==='Full width'); row.querySelector('.checkbox-container').click(); })()`);
await c.sleep(400);
console.log('after toggling Full width, Width row shown:', await c.evaluate(`(() => { const el=app.setting.pluginTabs.find(t=>t.id==='reading-ruler').containerEl; return [...el.querySelectorAll('.setting-item-name')].some(e=>e.innerText==='Width'); })()`), '| overlay full-width class:', await c.evaluate(`document.querySelector('.reading-ruler-overlay').classList.contains('is-full-width')`));
await c.evaluate(`(() => { const el=app.setting.pluginTabs.find(t=>t.id==='reading-ruler').containerEl; const row=[...el.querySelectorAll('.setting-item')].find(e=>e.querySelector('.setting-item-name')?.innerText==='Full width'); row.querySelector('.checkbox-container').click(); })()`);
await c.sleep(300);
await c.screenshot('shot-18-old-settings.png');
await c.evaluate(`app.setting.close()`);
console.log('console errors from plugin: check obsidian log');
c.close();
