// Reloads the plugin so the latest build is active, and makes sure the two-pane test layout exists.
import { connect } from './cdp.mjs';
const c = await connect();
console.log(await c.evaluate(`(async()=>{ await app.plugins.disablePlugin('reading-ruler'); await app.plugins.enablePlugin('reading-ruler'); await new Promise(r=>setTimeout(r,700)); return 'reloaded; overlays=' + document.querySelectorAll('.reading-ruler-overlay').length + ' pieces=' + document.querySelectorAll('.reading-ruler-overlay > *').length; })()`));
c.close();
