import { connect } from './cdp.mjs';
const c = await connect();
await c.evaluate(`(async()=>{ app.setting.open(); app.setting.openTabById('reading-ruler'); await new Promise(r=>setTimeout(r,1200)); })()`);
const targets = await (await fetch('http://127.0.0.1:9333/json/list')).json();
console.log('targets:', targets.filter(t=>t.type==='page').map(t=>t.title+' | '+t.url).join(' ; '));
const info = await c.evaluate(`(() => { const el=app.setting.pluginTabs.find(t=>t.id==='reading-ruler').containerEl; return JSON.stringify({sameDoc: el.ownerDocument===document, names:[...el.querySelectorAll('.setting-item-name, .setting-group-heading, .setting-item-heading')].map(e=>e.innerText).filter(Boolean)}); })()`);
console.log('declarative render:', info);
c.close();
