#!/usr/bin/env node
// Patches @electron/rebuild's node-gyp.js to use import.meta.url instead of
// import.meta.dirname, which is undefined when the module is dynamically
// imported inside a forked CJS process by app-builder-lib.
const fs = require('fs')
const path = require('path')

const target = path.resolve(__dirname, '../node_modules/@electron/rebuild/lib/module-type/node-gyp/node-gyp.js')

if (!fs.existsSync(target)) {
  console.log('postinstall: @electron/rebuild not found, skipping patch')
  process.exit(0)
}

let src = fs.readFileSync(target, 'utf8')

const before = "path.resolve(import.meta.dirname, 'worker.js')"
const after  = "new URL('worker.js', import.meta.url)"

if (!src.includes(before)) {
  console.log('postinstall: @electron/rebuild already patched or changed, skipping')
  process.exit(0)
}

fs.writeFileSync(target, src.replace(before, after))
console.log('postinstall: patched @electron/rebuild node-gyp.js ✓')
