const fs = require('node:fs')
async function main() {
  const targets = await (await fetch('http://127.0.0.1:9452/json/list')).json()
  const page = targets.find(x => x.type === 'page' && x.url.includes('localhost:'))
  if (!page) throw Error('Dev renderer not found')
  const socket = new WebSocket(page.webSocketDebuggerUrl)
  await new Promise((ok, fail) => {
    socket.addEventListener('open', ok, { once: true }); socket.addEventListener('error', fail, { once: true })
  })
  const handlers = new Map()
  let serial = 0
  socket.addEventListener('message', e => {
    const o = JSON.parse(e.data)
    if (!handlers.has(o.id)) return
    const { resolve, reject } = handlers.get(o.id)
    handlers.delete(o.id)
    o.error ? reject(new Error(o.error.message)) : resolve(o.result)
  })
  const cdp = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++serial
    handlers.set(id, { resolve, reject })
    socket.send(JSON.stringify({ id, method, params }))
  })
  const js = async expression => {
    const { result, exceptionDetails } = await cdp('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
    if (exceptionDetails) throw Error(exceptionDetails.text)
    return result.value
  }
  const sleep = t => new Promise(ok => setTimeout(ok, t))
  await cdp('Runtime.enable')
  await js("document.querySelector('[aria-label=\"Saker Brain\"]')?.click()")
  await js("[...document.querySelectorAll('[role=\"tab\"]')].find(x=>x.textContent.includes('Graph'))?.click()")
  await sleep(250)
  const before = await js("(()=>{const n=document.querySelector('.saker-graph-node-section');if(!n)return null;const b=n.getBoundingClientRect();return {x:b.x+b.width/2,y:b.y+b.height/2,left:parseFloat(n.style.left),top:parseFloat(n.style.top)}})()")
  if (!before) throw Error('No draggable graph node')
  await cdp('Input.dispatchMouseEvent', { type: 'mouseMoved', x: before.x, y: before.y, button: 'none' })
  await cdp('Input.dispatchMouseEvent', { type: 'mousePressed', x: before.x, y: before.y, button: 'left', buttons: 1, clickCount: 1 })
  for (let i = 1; i <= 6; i++) {
    await cdp('Input.dispatchMouseEvent', { type: 'mouseMoved', x: before.x + i * 12, y: before.y + i * 5, button: 'left', buttons: 1 })
    await sleep(16)
  }
  await cdp('Input.dispatchMouseEvent', { type: 'mouseReleased', x: before.x + 72, y: before.y + 30, button: 'left', buttons: 0, clickCount: 1 })
  await sleep(200)
  const after = await js("(()=>{const n=document.querySelector('.saker-graph-node-section'); return {left:parseFloat(n.style.left),top:parseFloat(n.style.top),stored:!!localStorage.getItem('saker.graph.layout.v1')}})()")
  console.log('DRAG', { before, after })
  if (Math.abs(before.left - after.left) < 15 || !after.stored) throw Error('Node drag or persistence failed')
  await js("[...document.querySelectorAll('.saker-graph-tool')].find(x=>x.title==='Reset positions')?.click()")
  await sleep(160)
  const cleared = await js("localStorage.getItem('saker.graph.layout.v1')===null")
  if (!cleared) throw Error('Graph reset failed')
  await js("[...document.querySelectorAll('[role=\"tab\"]')].find(x=>x.textContent.includes('Notes'))?.click()")
  await js("[...document.querySelectorAll('.saker-brain-mode')].find(x=>x.textContent.toLowerCase()==='split')?.click()")
  await sleep(120)
  const split = await js("({editor:!!document.querySelector('.saker-brain-source'),preview:!!document.querySelector('.saker-brain-preview')})")
  console.log('SPLIT', split)
  if (!split.editor || !split.preview) throw Error('Markdown split view failed')
  await js("[...document.querySelectorAll('.saker-brain-mode')].find(x=>x.textContent.toLowerCase()==='preview')?.click()")
  await js("[...document.querySelectorAll('[title=\"Close Brain\"]')].forEach(x=>x.click())")
  await sleep(180)
  const explorer = await js("({rows:document.querySelectorAll('[data-file-explorer-row]').length,svg:document.querySelectorAll('[data-file-explorer-row] svg[viewBox=\"0 0 16 16\"]').length,hiddenRows:[...document.querySelectorAll('[data-file-explorer-row]')].filter(x=>/\\.cargo|\\.android|\\.cache/.test(x.textContent)).length})")
  console.log('EXPLORER', explorer)
  if (explorer.rows > 0 && explorer.svg === 0) throw Error('Custom explorer icons not rendered')
  socket.close()
}
main().catch(e => { console.error(e); process.exitCode = 1 })
