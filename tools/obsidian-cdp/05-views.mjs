import { connect } from './cdp.mjs';
const c = await connect();
const j = async (e) => JSON.parse(await c.evaluate(`JSON.stringify(${e})`));
const overlays = () => j(`[...document.querySelectorAll('.reading-ruler-overlay')].map(el=>{ const r=rrBand(el === document ? undefined : el); const h=el.parentElement.getBoundingClientRect(); const lc=el.closest('.workspace-leaf-content'); return {type:lc.dataset.type, mode:lc.dataset.mode, cls:el.className.replace('reading-ruler-overlay','').trim(), host:[Math.round(h.left),Math.round(h.top),Math.round(h.width),Math.round(h.height)], bandCentre:Math.round(r.top+r.height/2), bandW:Math.round(r.width)}; })`);
// Reading view
await c.evaluate(`app.commands.executeCommandById('markdown:toggle-preview')`); await c.sleep(600);
console.log('reading view:', JSON.stringify(await overlays()));
await c.mouse('mouseMoved', 684, 300); await c.mouse('mouseMoved', 684, 450); await c.sleep(150);
console.log(' after move :', JSON.stringify(await overlays()));
console.log(' link under band clickable:', await c.evaluate(`(() => { const a=document.querySelector('.markdown-reading-view a.internal-link'); const r=a.getBoundingClientRect(); const e=document.elementFromPoint(r.left+5,r.top+5); return e===a || a.contains(e); })()`));
// Split with PDF
await c.evaluate(`(async () => { const f=app.vault.getAbstractFileByPath('Large document.pdf'); await app.workspace.getLeaf('split').openFile(f); await new Promise(r=>setTimeout(r,2500)); })()`);
console.log('split + pdf :', JSON.stringify(await overlays()));
const pdf = (await overlays()).find(o=>o.type==='pdf');
const px = pdf.host[0]+pdf.host[2]/2, py = pdf.host[1]+400;
await c.mouse('mouseMoved', px, py-30); await c.mouse('mouseMoved', px, py); await c.sleep(200);
console.log(' pdf follow  :', JSON.stringify((await overlays()).find(o=>o.type==='pdf')), 'expected centre', py);
console.log(' pdf hit-test:', await c.evaluate(`(() => { const e=document.elementFromPoint(${px},${py}); return e.tagName+'.'+String(e.className).slice(0,40)+' insidePdfViewer='+!!e.closest('.pdfViewer'); })()`));
console.log(' pdf scroller:', JSON.stringify(await j(`(() => { const s=document.querySelector('.pdf-viewer-container'); return {scrollH:s.scrollHeight, clientH:s.clientHeight, overlayInsideScroller: !!s.querySelector('.reading-ruler-overlay')}; })()`)));
// wheel-scroll the PDF through the overlay
const before = await c.evaluate(`document.querySelector('.pdf-viewer-container').scrollTop`);
await c.send('Input.dispatchMouseEvent', { type:'mouseWheel', x:px, y:py, deltaX:0, deltaY:900 }); await c.sleep(500);
const after = await c.evaluate(`document.querySelector('.pdf-viewer-container').scrollTop`);
console.log(' pdf wheel scroll through overlay:', before, '->', after, ' band stays:', JSON.stringify((await overlays()).find(o=>o.type==='pdf').bandCentre));
await c.screenshot('shot-05-split.png');
c.close();
