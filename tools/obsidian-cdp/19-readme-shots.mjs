// Takes the screenshots used in the README. Expects a note called Demo.md in the test vault.
import { writeFileSync } from 'node:fs';
import { connect } from './cdp.mjs';
const c = await connect();
const tab = `app.setting.pluginTabs.find(t=>t.id==='reading-ruler')`;
const set = (k, v) => c.evaluate(`${tab}.setControlValue('${k}', ${JSON.stringify(v)})`);
await c.send('Emulation.setDeviceMetricsOverride', { width: 1100, height: 720, deviceScaleFactor: 2, mobile: false });
console.log(await c.evaluate(`(async()=>{
	app.workspace.leftSplit.collapse(); app.workspace.rightSplit.collapse();
	let file=null; for (let i=0;i<20 && !file;i++){ file=app.vault.getAbstractFileByPath('Demo.md'); if(!file) await new Promise(r=>setTimeout(r,250)); }
	if(!file) return 'Demo.md not found';
	const leaf=app.workspace.getLeavesOfType('markdown')[0] ?? app.workspace.getLeaf(false);
	await leaf.openFile(file, { state: { mode: 'preview' } });
	app.workspace.setActiveLeaf(leaf, { focus: true });
	await new Promise(r=>setTimeout(r,900));
	return 'opened ' + leaf.view.file.path + ' in ' + leaf.view.getMode();
})()`));
for (const [k, v] of Object.entries({ enabled: true, bandHeight: 70, dimStrength: 55, fullWidth: true, widthPercent: 100, tintStrength: 0 })) await set(k, v);
// aim at the middle of the third paragraph
const target = JSON.parse(await c.evaluate(`JSON.stringify((() => { const p=[...document.querySelectorAll('.markdown-reading-view p')][2].getBoundingClientRect(); return { x: p.left + p.width/2, y: p.top + p.height/2 }; })())`));
const shot = async (file) => { await c.mouse('mouseMoved', target.x, target.y - 15); await c.mouse('mouseMoved', target.x, target.y); await c.sleep(400); const r = await c.send('Page.captureScreenshot', { format: 'png' }); writeFileSync(file, Buffer.from(r.data, 'base64')); console.log('wrote', file); };
await c.evaluate(`app.changeTheme('moonstone')`); await c.sleep(500);
await shot('../../images/reading-ruler-light.png');
await c.evaluate(`app.changeTheme('obsidian')`); await c.sleep(500);
await set('tintStrength', 20); await set('fullWidth', false); await set('widthPercent', 70);
await shot('../../images/reading-ruler-dark-tint.png');
await c.evaluate(`app.changeTheme('moonstone')`);
await c.send('Emulation.clearDeviceMetricsOverride');
c.close();
