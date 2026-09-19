// Visual check of the custom-width band: the four dim pieces must meet without seams or overlap.
import { connect } from './cdp.mjs';
const c = await connect();
const tab = `app.setting.pluginTabs.find(t=>t.id==='reading-ruler')`;
const set = (k, v) => c.evaluate(`${tab}.setControlValue('${k}', ${JSON.stringify(v)})`);
await set('fullWidth', false); await set('widthPercent', 55); await set('tintStrength', 0); await set('dimStrength', 60);
await c.mouse('mouseMoved', 480, 300); await c.mouse('mouseMoved', 511, 377); await c.sleep(300);
console.log(await c.evaluate(`JSON.stringify((() => { const o=document.querySelector('.workspace-leaf-content[data-type="markdown"] .reading-ruler-overlay'); const r=(m)=>{ const b=o.querySelector('.mod-'+m).getBoundingClientRect(); return [b.left,b.top,b.right,b.bottom]; }; return {top:r('top'), bottom:r('bottom'), left:r('left'), right:r('right'), layers:[...o.children].filter(e=>getComputedStyle(e).display!=='none').length}; })())`));
const shot = await c.send('Page.captureScreenshot', { format: 'png', clip: { x: 344, y: 300, width: 340, height: 160, scale: 3 } });
(await import('node:fs')).writeFileSync('shot-16-seams.png', Buffer.from(shot.data, 'base64'));
await set('fullWidth', true); await set('widthPercent', 100); await set('dimStrength', 50);
c.close();
