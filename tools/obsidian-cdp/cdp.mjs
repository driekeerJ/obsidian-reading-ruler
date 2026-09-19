import { writeFileSync } from 'node:fs';
const PORT = 9333;
export async function connect(match = (t) => t.type === 'page' && t.url.startsWith('app://')) {
	const targets = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
	const target = targets.find(match);
	if (!target) throw new Error('no target: ' + JSON.stringify(targets.map((t) => t.title)));
	const ws = new WebSocket(target.webSocketDebuggerUrl);
	await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
	let id = 0; const pending = new Map(); const handlers = new Map();
	ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.method && handlers.has(d.method)) handlers.get(d.method)(d.params); if (d.id && pending.has(d.id)) { const { res, rej } = pending.get(d.id); pending.delete(d.id); d.error ? rej(new Error(JSON.stringify(d.error))) : res(d.result); } };
	const send = (method, params = {}) => new Promise((res, rej) => { pending.set(++id, { res, rej }); ws.send(JSON.stringify({ id, method, params })); });
	// The clear band is the gap between the dim pieces; rrBand() measures it for an overlay (or a selector prefix).
	const helper = `window.rrBand = (scope) => { const o = typeof scope === 'string' ? document.querySelector(scope + ' .reading-ruler-overlay') ?? document.querySelector(scope) : (scope ?? document.querySelector('.reading-ruler-overlay')); const q = (m) => o.querySelector('.reading-ruler-dim.mod-' + m).getBoundingClientRect(); const host = o.getBoundingClientRect(); const top = q('top').bottom, bottom = q('bottom').top; const full = o.classList.contains('is-full-width'); const left = full ? host.left : q('left').right, right = full ? host.right : q('right').left; return { top, left, width: right - left, height: bottom - top }; };`;
	const evaluate = async (expression) => {
		expression = helper + '\n' + expression;
		const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true, userGesture: true });
		if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? JSON.stringify(r.exceptionDetails));
		return r.result.value;
	};
	const mouse = (type, x, y, extra = {}) => send('Input.dispatchMouseEvent', { type, x, y, button: 'none', ...extra });
	const screenshot = async (file) => { const r = await send('Page.captureScreenshot', { format: 'png' }); writeFileSync(file, Buffer.from(r.data, 'base64')); return file; };
	const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
	const on = (method, cb) => handlers.set(method, cb);
	return { send, on, evaluate, mouse, screenshot, sleep, close: () => ws.close(), targets };
}
