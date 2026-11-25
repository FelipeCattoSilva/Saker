const fs = require('node:fs')
const path = require('node:path')
async function run() {
  const dir = path.join(process.cwd(), 'out', 'saker-brain-ipc-smoke')
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, 'README.md'), '# Test project\n\nA temporary verification project.\n')
  const targets = await (await fetch('http://127.0.0.1:9452/json/list')).json()
  const page = targets.find(t => t.type === 'page' && t.url.includes('localhost'))
  if (!page) throw Error('Saker dev renderer unavailable')
  const ws = new WebSocket(page.webSocketDebuggerUrl)
  await new Promise((ok, fail) => { ws.addEventListener('open', ok, { once: true });ws.addEventListener('error', fail, { once: true }) })
  let seq = 0
  const pending = new Map()
  ws.addEventListener('message', e => {
    const data = JSON.parse(e.data)
    if (!pending.has(data.id)) return
    const { resolve, reject } = pending.get(data.id)
    pending.delete(data.id)
    data.error ? reject(Error(data.error.message)) : resolve(data.result)
  })
  const evaluate = expr => new Promise((resolve, reject) => {
    const id = ++seq
    pending.set(id, { resolve, reject })
    ws.send(JSON.stringify({ id, method: 'Runtime.evaluate', params: { expression: expr, awaitPromise: true, returnByValue: true } }))
  }).then(out => {if(out.exceptionDetails)throw Error(out.exceptionDetails.text);return out.result.value})
  try {
    const repos = JSON.stringify([{ name: 'Saker Brain Test Project', path: dir }])
    const state = await evaluate('window.api.sakerBrain.sync(' + repos + ').then(x=>({projects:x.projects.map(p=>({id:p.id,name:p.name,enabled:p.enabled})),index:x.index}))')
    console.log('CREATED', { projects: state.projects, indexHasProject: state.index.includes('Saker Brain Test Project') })
    if (state.projects.length !== 1) throw Error('Auto creation failed')
    const brainPath = path.join(dir, '.saker', 'brain.md')
    if (!fs.existsSync(brainPath) || !fs.existsSync(path.join(dir, 'AGENTS.md'))) throw Error('Agent memory files missing')
    const id = state.projects[0].id
    const disabled = await evaluate('window.api.sakerBrain.setProjectEnabled(' + JSON.stringify(id) + ',false).then(x=>x.projects[0].enabled)')
    if (disabled !== false) throw Error('Disable toggle failed')
    const reen = await evaluate('window.api.sakerBrain.setProjectEnabled(' + JSON.stringify(id) + ',true).then(x=>x.projects[0].enabled)')
    if (reen !== true) throw Error('Enable toggle failed')
    console.log('TOGGLES', { disabled, reenabled: reen, brainPreserved: fs.existsSync(brainPath) })
  } finally {
    await evaluate('window.api.sakerBrain.sync([])').catch(() => {})
    ws.close()
    fs.rmSync(dir, { recursive: true, force: true })
  }
}
run().catch(e => { console.error(e); process.exitCode = 1 })
