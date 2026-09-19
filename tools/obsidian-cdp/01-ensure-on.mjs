// Turns the ruler on (if needed) with a 60 px band so the numbers in the other scripts line up.
import { connect } from './cdp.mjs';
const c = await connect();
console.log(await c.evaluate(`(async()=>{ const tab=app.setting.pluginTabs.find(t=>t.id==='reading-ruler'); tab.setControlValue('enabled', true); tab.setControlValue('bandHeight', 60); tab.setControlValue('fixedPercent', 35); await new Promise(r=>setTimeout(r,400)); return 'ruler on, band 60px'; })()`));
c.close();
