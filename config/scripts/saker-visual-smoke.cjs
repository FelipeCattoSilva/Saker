/* Saker visual smoke test via Electron's development CDP; no browser interaction with user data. */
const fs = require('node:fs')
const path = require('node:path')
async function main() {
  const targets = await (await fetch('http://127.0.0.1:9452/json/list')).json()
  const target = targets.find(x => x.type === 'page' && x.url.includes('localhost:'))
  if (!target) throw new Error('Saker renderer page unavailable')
  const socket = new WebSocket(target.webSocketDebuggerUrl)
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true })
    socket.addEventListener('error', reject, { once: true })
  })
  let nextId = 0
  const promises = new Map()
  socket.addEventListener('message', event => {
    const response = JSON.parse(event.data)
    if (response.id && promises.has(response.id)) {
      const { resolve, reject } = promises.get(response.id)
      promises.delete(response.id)
      response.error ? reject(Error(response.error.message)) : resolve(response.result)
    }
  })
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++nextId
    promises.set(id, { resolve, reject })
    socket.send(JSON.stringify({ id, method, params }))
  })
  const evaluate = async expression => {
    const res = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
    if (res.exceptionDetails) throw Error(res.exceptionDetails.text)
    return res.result.value
  }
  const sleep = ms => new Promise(r => setTimeout(r, ms))
  await send('Runtime.enable')
  await send('Page.enable')
  console.log('initial', await evaluate("({title:document.title,ready:document.readyState,root:!!document.querySelector('#root'),brainButtons:document.querySelectorAll('[aria-label=\"Saker Brain\"]').length,text:document.body.innerText.slice(0,270)})"))
  await evaluate("document.querySelector('[aria-label=\"Saker Brain\"]')?.click()")
  await sleep(900)
  await evaluate("[...document.querySelectorAll('[role=\"tab\"]')].find(x => x.textContent.includes('Graph'))?.click()")
  await sleep(350)
  console.log('graph', await evaluate("({dialog:!!document.querySelector('[role=\"dialog\"]'),tabs:[...document.querySelectorAll('[role=\"tab\"]')].map(x=>x.textContent),nodes:document.querySelectorAll('.saker-graph-node').length,edges:document.querySelectorAll('.saker-graph-stage line').length,body:document.querySelector('[role=\"dialog\"]')?.innerText.slice(0,380)})"))
  const screenshot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
  const file = path.join(__dirname, '../../out/saker-brain-graph-smoke.png')
  fs.writeFileSync(file, Buffer.from(screenshot.data, 'base64'))
  console.log('screenshot', file)
  await evaluate("[...document.querySelectorAll('[role=\"tab\"]')].find(x => x.textContent.includes('Notes'))?.click()")
  await sleep(300)
  const notesImage = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
  fs.writeFileSync(path.join(__dirname, '../../out/saker-brain-notes-smoke.png'), Buffer.from(notesImage.data, 'base64'))
  console.log('notes', await evaluate("({preview:!!document.querySelector('.saker-brain-preview'),headings:document.querySelectorAll('.saker-brain-markdown h1,.saker-brain-markdown h2').length,buttons:[...document.querySelectorAll('.saker-brain-mode')].map(x=>x.textContent)})"))
  await evaluate("[...document.querySelectorAll('[role=\"tab\"]')].find(x => x.textContent.includes('Index'))?.click()")
  await sleep(250)
  console.log('index', await evaluate("({heading:document.querySelector('[role=\"tabpanel\"] h2')?.textContent,projects:document.querySelectorAll('.saker-brain-index-card').length})"))
  socket.close()
}
main().catch(e => { console.error(e); process.exitCode = 1 })
