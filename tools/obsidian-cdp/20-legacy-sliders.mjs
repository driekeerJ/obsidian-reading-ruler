// Pre-1.13 settings tab: sliders show their value inline and update the ruler live.
import { connect } from './cdp.mjs';
const c = await connect();
console.log('app version:', await c.evaluate(`require('electron').ipcRenderer.sendSync('version')`));
await c.evaluate(`(async()=>{ await app.plugins.disablePlugin('reading-ruler'); await app.plugins.enablePlugin('reading-ruler'); await new Promise(r=>setTimeout(r,600)); app.setting.open(); app.setting.openTabById('reading-ruler'); await new Promise(r=>setTimeout(r,800)); })()`);
const rows = () => c.evaluate(`JSON.stringify([...app.setting.pluginTabs.find(t=>t.id==='reading-ruler').containerEl.querySelectorAll('.setting-item')].filter(e=>e.querySelector('input[type=range]')).map(e=>({name:e.querySelector('.setting-item-name').innerText, label:e.querySelector('.reading-ruler-slider-value')?.innerText, slider:e.querySelector('input[type=range]').value})))`);
console.log('sliders   :', await rows());
// drag the band height slider through the real input element: 'input' updates the label, 'change' saves
await c.evaluate(`(() => { const el=app.setting.pluginTabs.find(t=>t.id==='reading-ruler').containerEl; const row=[...el.querySelectorAll('.setting-item')].find(e=>e.querySelector('.setting-item-name')?.innerText==='Band height'); const s=row.querySelector('input[type=range]'); s.value='120'; s.dispatchEvent(new Event('input',{bubbles:true})); })()`);
console.log('after input (label only):', JSON.parse(await rows())[0], '| model:', await c.evaluate(`app.setting.pluginTabs.find(t=>t.id==='reading-ruler').getControlValue('bandHeight')`));
await c.evaluate(`(() => { const el=app.setting.pluginTabs.find(t=>t.id==='reading-ruler').containerEl; const row=[...el.querySelectorAll('.setting-item')].find(e=>e.querySelector('.setting-item-name')?.innerText==='Band height'); row.querySelector('input[type=range]').dispatchEvent(new Event('change',{bubbles:true})); })()`);
await c.sleep(300);
console.log('after change            :', JSON.parse(await rows())[0], '| model:', await c.evaluate(`app.setting.pluginTabs.find(t=>t.id==='reading-ruler').getControlValue('bandHeight')`), '| css var:', await c.evaluate(`document.querySelector('.reading-ruler-overlay').style.getPropertyValue('--rr-height')`));
// structural re-render still works
await c.evaluate(`(() => { const el=app.setting.pluginTabs.find(t=>t.id==='reading-ruler').containerEl; const row=[...el.querySelectorAll('.setting-item')].find(e=>e.querySelector('.setting-item-name')?.innerText==='Full width'); row.querySelector('.checkbox-container').click(); })()`);
await c.sleep(400);
console.log('Width row after toggling Full width:', JSON.parse(await rows()).find(r=>r.name==='Width'));
await c.screenshot('shot-20-legacy.png');
await c.evaluate(`app.setting.close()`);
c.close();
