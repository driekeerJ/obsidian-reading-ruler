# Driving a real Obsidian through the Chrome DevTools Protocol

These scripts were used to verify the plugin in a real Obsidian on desktop.
They are development aids, not part of the plugin, and they are not a test
suite: each script prints measurements that you compare with the expectation
printed next to them.

They talk to a **second, isolated** Obsidian instance, so your normal Obsidian
and its configuration are never touched.

## Setup

1. Create a test vault with a long note (`Long note.md`), a second note and a
   multi-page PDF (`Large document.pdf`), and symlink `main.js`,
   `manifest.json` and `styles.css` into
   `<vault>/.obsidian/plugins/reading-ruler/`. Put `["reading-ruler"]` in
   `<vault>/.obsidian/community-plugins.json`.
2. Create an empty profile directory with an `obsidian.json` that registers
   the vault:

   ```json
   { "vaults": { "ru1ertest0000001": { "path": "/path/to/vault", "ts": 1, "open": true } } }
   ```

   Copy the newest `obsidian-x.y.z.asar` from
   `~/Library/Application Support/obsidian/` into it to run that app version.
3. Start Obsidian against that profile:

   ```bash
   /Applications/Obsidian.app/Contents/MacOS/Obsidian \
     --user-data-dir=/path/to/profile \
     --remote-debugging-port=9333 --remote-allow-origins='*'
   ```

4. Accept the "Trust author" prompt once, then run the scripts with Node 22 or
   later (they use the built-in `WebSocket` and `fetch`):

   ```bash
   node tools/obsidian-cdp/03-basic.mjs
   ```

The scripts build on each other's state (03 opens the note and turns the ruler
on, 05 creates the split with the PDF, 09 moves the PDF to a popout window).
Touch input is emulated with `Input.dispatchTouchEvent`; that is not a
substitute for testing on a real iPad.
