const fs = require('node:fs')
const path = require('node:path')
async function run() {
  const tabs = await (await fetch('http://127.0.0.1:' + (process.env.SAKER_TEST_CDP_PORT || '9452') + '/json/list')).json()
  const tab = tabs.find(t => t.type === 'page' && t.url.includes('localhost:'))
  if (!tab) throw Error('No Saker dev renderer')
  const ws = new WebSocket(tab.webSocketDebuggerUrl)
  await new Promise((ok, bad) => {
    ws.addEventListener('open', ok, { once: true })
    ws.addEventListener('error', bad, { once: true })
  })
  const pending = new Map()
  let seq = 0
  const exceptions = []
  ws.addEventListener('message', e => {
    const data = JSON.parse(e.data)
    if (data.method === 'Runtime.exceptionThrown') exceptions.push(data.params.exceptionDetails?.text)
    const task = pending.get(data.id)
    if (!task) return
    pending.delete(data.id)
    data.error ? task.reject(Error(data.error.message)) : task.resolve(data.result)
  })
  const send = (method, params = {}) => Promise.race([
    new Promise((resolve, reject) => {
      const n = ++seq
      pending.set(n, { resolve, reject })
      ws.send(JSON.stringify({ id: n, method, params }))
    }),
    new Promise((_, reject) => setTimeout(() => reject(Error('Timeout: '+method)), 10000))
  ])
  const js = async expression => {
    const data = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
    if (data.exceptionDetails) throw Error(data.exceptionDetails.text)
    return data.result?.value
  }
  const sleep = ms => new Promise(r => setTimeout(r, ms))
  const click = async (x, y) => {
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, button: 'none' })
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', buttons: 1, clickCount: 1 })
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', buttons: 0, clickCount: 1 })
  }
  try {
    await send('Runtime.enable')
    await send('Page.enable')
    const start = Date.now()
    const alreadyOpen = await js("!!document.querySelector('[role=\"dialog\"][data-state=\"open\"]')")
    if (!alreadyOpen) await js("document.querySelector('[aria-label=\"Saker Brain\"]')?.click()")
    await sleep(650)
    await js("[...document.querySelectorAll('[role=\"tab\"]')].find(x => x.textContent.includes('Graph'))?.click()")
    let ready = false
    for (let i = 0; i < 25; i++) {
      ready = await js("!!document.querySelector('.saker-graph-inspector') && !!document.querySelector('.saker-graph-surface canvas')")
      if (ready) break
      await sleep(140)
    }
    const openMs = Date.now() - start
    await sleep(1100)
    const info = await js("(()=>{const e=document.querySelector('.saker-graph-surface');if(!e)return null;const r=e.getBoundingClientRect();const saved=JSON.parse(localStorage.getItem('saker.graph.force.positions.v2')||'{}');return {rect:{x:r.x,y:r.y,width:r.width,height:r.height},node:saved.nodes?.global,initialInspector:document.querySelector('.saker-graph-inspector')?.innerText.slice(0,230),count:e.querySelector('canvas')?.dataset.sakerGraphNodes}})()")
    console.log('OPEN', { openMs, info })
    if (!ready || !info || !info.node) throw Error('Graph positions not available')
    const center = { x: info.rect.x + info.rect.width/2 + info.node.x, y: info.rect.y + info.rect.height/2 + info.node.y }
    await click(center.x, center.y)
    await sleep(180)
    const selected = await js("document.querySelector('.saker-graph-inspector')?.innerText.slice(0,500)")
    console.log('SELECTED', selected)
    if (!selected.includes('General Brain') || !selected.toLowerCase().includes('links to')) throw Error('Node inspector failed')
    const shot = await send('Page.captureScreenshot', { format:'png', captureBeyondViewport:false })
    fs.writeFileSync(path.join(__dirname,'../../out/saker-graph-inspector-test.png'),Buffer.from(shot.data,'base64'))
    await click(info.rect.x+22,info.rect.y+25)
    await sleep(200)
    const cleared = await js("document.querySelector('.saker-graph-inspector')?.innerText.slice(0,280)")
    console.log('DESELECTED',cleared)
    if (!cleared.includes('Select a node')) throw Error('Click blank did not deselect')
    const brainReadMs=await js("(async()=>{const t=performance.now();await window.api.sakerBrain.get();return Math.round(performance.now()-t)})()")
    console.log('BRAIN_READ_MS',brainReadMs)
    console.log('RUNTIME_EXCEPTIONS',exceptions)
  } finally { ws.close() }
}
run().catch(e=>{console.error(e);process.exitCode=1})
