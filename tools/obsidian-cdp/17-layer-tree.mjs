// Reports the real compositor layers created for the ruler and the per-frame cost while following.
import { connect } from './cdp.mjs';
const label = process.argv[2] ?? 'build';
const c = await connect();
let tree = null;
c.on('LayerTree.layerTreeDidChange', (p) => { if (p.layers) tree = p.layers; });
await c.send('DOM.enable'); await c.send('DOM.getDocument', { depth: 0 });
await c.send('LayerTree.enable');
const host = JSON.parse(await c.evaluate(`JSON.stringify((() => { const h=document.querySelector('.workspace-leaf-content[data-type="markdown"] .reading-ruler-host').getBoundingClientRect(); return [h.left,h.top,h.width,h.height]; })())`));
await c.mouse('mouseMoved', host[0]+host[2]/2, host[1]+200); await c.mouse('mouseMoved', host[0]+host[2]/2, host[1]+260); await c.sleep(800);
// which layers belong to ruler elements?
const rulerNodeIds = new Set();
const { root } = await c.send('DOM.getDocument', { depth: 0 });
const { nodeIds } = await c.send('DOM.querySelectorAll', { nodeId: root.nodeId, selector: '.reading-ruler-overlay, .reading-ruler-overlay *' });
const backend = new Set();
for (const nodeId of nodeIds) { const d = await c.send('DOM.describeNode', { nodeId }); backend.add(d.node.backendNodeId); }
const mine = (tree ?? []).filter((l) => backend.has(l.backendNodeId));
const mp = (l) => (l.width * l.height) / 1e6;
console.log(`[${label}] ruler layers: ${mine.length}; sizes: ${mine.map((l) => `${Math.round(l.width)}x${Math.round(l.height)}${l.drawsContent ? '' : '(no content)'}`).join(', ')}`);
console.log(`[${label}] ruler layer area: ${mine.reduce((a, l) => a + mp(l), 0).toFixed(2)} MP (CSS px) | all layers on page: ${(tree ?? []).length}, ${(tree ?? []).reduce((a, l) => a + mp(l), 0).toFixed(2)} MP`);
await c.send('LayerTree.disable');
// per-frame cost while following
await c.send('Performance.enable');
const metrics = async () => Object.fromEntries((await c.send('Performance.getMetrics')).metrics.map((m) => [m.name, m.value]));
const m0 = await metrics(); const t0 = Date.now(); let i = 0;
while (Date.now() - t0 < 3000) { await c.mouse('mouseMoved', host[0] + host[2]/2 + (i%5), host[1] + 60 + (i*7) % (host[3]-120)); i++; }
const m1 = await metrics();
const per = (k) => (((m1[k] - m0[k]) * 1000) / i).toFixed(3);
console.log(`[${label}] follow ${i} moves: style ${per('RecalcStyleDuration')} ms/move, layout ${per('LayoutDuration')} ms/move, script ${per('ScriptDuration')} ms/move, layouts ${m1.LayoutCount - m0.LayoutCount}`);
c.close();
