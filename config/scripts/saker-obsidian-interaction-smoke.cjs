async function main() {
  const pages = await (await fetch('http://127.0.0.1:9452/json/list')).json()
  const page = pages.find(p => p.type==='page' && p.url.includes('localhost:'))
  if (!page) throw Error('Dev window not found')
  const ws = new WebSocket(page.webSocketDebuggerUrl)
  await new Promise((resolve,reject) => {
    ws.addEventListener('open',resolve,{once:true});ws.addEventListener('error',reject,{once:true})
  })
  const pending = new Map()
  let id=0
  ws.addEventListener('message',e=>{
    const data=JSON.parse(e.data)
    const p=pending.get(data.id)
    if(!p)return
    pending.delete(data.id)
    data.error?p.reject(new Error(data.error.message)):p.resolve(data.result)
  })
  const send=(method,params={})=>Promise.race([
    new Promise((resolve,reject)=>{
      const n=++id
      pending.set(n,{resolve,reject})
      ws.send(JSON.stringify({id:n,method,params}))
    }),
    new Promise((_,reject)=>setTimeout(()=>reject(Error('CDP timed out: '+method)),7000))
  ])
  const ev=async expression=>{
    const data=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true})
    if(data.exceptionDetails)throw Error(data.exceptionDetails.exception?.description||data.exceptionDetails.text)
    return data.result?.value
  }
  try {
    await send('Runtime.enable')
    await ev("document.querySelector('[aria-label=\"Saker Brain\"]')?.click()")
    await ev("[...document.querySelectorAll('[role=\"tab\"]')].find(x=>x.textContent==='Graph')?.click()")
    await new Promise(r=>setTimeout(r,1200))
    const initial=await ev("({graph:!!document.querySelector('.saker-graph-surface canvas'),zoom:document.querySelector('[aria-label=\"Zoom in\"]')?.parentElement.innerText,views:[...document.querySelectorAll('.saker-graph-view-button')].map(x=>x.textContent)})")
    console.log('INITIAL',initial)
    await ev("document.querySelector('[aria-label=\"Zoom in\"]')?.click()")
    const afterZoom=await ev("document.querySelector('[aria-label=\"Zoom in\"]')?.parentElement.innerText")
    console.log('ZOOM_BUTTON',afterZoom)
    if(!afterZoom.includes('120%'))throw Error('Zoom in failed')
    const wheel=await ev("(()=>{const s=document.querySelector('.saker-graph-surface'),r=s.getBoundingClientRect();s.dispatchEvent(new WheelEvent('wheel',{bubbles:true,cancelable:true,deltaY:200,clientX:r.x+r.width/2,clientY:r.y+r.height/2}));return true})()")
    const afterWheel=await ev("document.querySelector('[aria-label=\"Zoom in\"]')?.parentElement.innerText")
    console.log('WHEEL',wheel,afterWheel)
    if(afterWheel.includes('120%'))throw Error('Wheel zoom did not update')
    await ev("[...document.querySelectorAll('.saker-graph-view-button')].find(x=>x.textContent==='Local')?.click()")
    const local=await ev("({depth:document.body.innerText.includes('Depth'),nodes:document.querySelector('.saker-graph-surface canvas')?.dataset.sakerGraphNodes})")
    console.log('LOCAL',local)
    if(!local.depth)throw Error('Local controls not shown')
    await ev("[...document.querySelectorAll('.saker-graph-view-button')].find(x=>x.textContent==='Global')?.click()")
    console.log('PASS')
  } finally { ws.close() }
}
main().catch(e=>{console.error(e);process.exitCode=1})
