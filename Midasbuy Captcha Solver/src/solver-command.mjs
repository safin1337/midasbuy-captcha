export async function solverCommand(target,method,params={},timeoutMs=8000) {
  let timer;
  try {
    return await Promise.race([chrome.debugger.sendCommand(target,method,params),
      new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error(`${method} timed out. Stop and analyze the puzzle again.`)),timeoutMs);})]);
  } finally {clearTimeout(timer);}
}
