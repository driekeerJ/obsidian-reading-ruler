import { connect } from './cdp.mjs';
const c = await connect();
await c.evaluate(`(async()=>{ await app.plugins.disablePlugin('reading-ruler'); const left=document.querySelectorAll('.reading-ruler-overlay,.reading-ruler-host').length; await app.plugins.enablePlugin('reading-ruler'); await new Promise(r=>setTimeout(r,600)); window.__left=left; })()`);
console.log('elements left after unload:', await c.evaluate('window.__left'), '| overlays after reload:', await c.evaluate(`document.querySelectorAll('.reading-ruler-overlay').length`));
// back to edit mode in the markdown leaf and open search
await c.evaluate(`(async()=>{ const l=app.workspace.getLeavesOfType('markdown')[0]; app.workspace.setActiveLeaf(l,{focus:true}); await new Promise(r=>setTimeout(r,200)); app.commands.executeCommandById('markdown:toggle-preview'); await new Promise(r=>setTimeout(r,500)); app.commands.executeCommandById('editor:open-search'); await new Promise(r=>setTimeout(r,500)); })()`);
console.log('search bar z vs overlay:', await c.evaluate(`(() => { const s=document.querySelector('.document-search-container'); if(!s) return 'no search bar'; const r=s.getBoundingClientRect(); const e=document.elementFromPoint(r.left+r.width/2, r.top+r.height/2); return 'search found; parent display='+getComputedStyle(s.parentElement).display+' z='+getComputedStyle(s).zIndex; })()`));
await c.mouse('mouseMoved', 500, 300); await c.mouse('mouseMoved', 500, 420); await c.sleep(300);
await c.screenshot('shot-06-search.png');
c.close();
