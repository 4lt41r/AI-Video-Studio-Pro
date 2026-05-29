// Dev launcher — waits for Vite dev server then opens Electron
const { spawn } = require('child_process')
const http = require('http')

function waitForVite(retries = 40) {
  return new Promise((resolve, reject) => {
    let attempts = 0
    const check = () => {
      attempts++
      const req = http.get('http://localhost:5173', res => {
        if (res.statusCode < 500) resolve()
        else tryAgain()
      })
      req.on('error', tryAgain)
      req.setTimeout(300, () => { req.destroy(); tryAgain() })
    }
    const tryAgain = () => {
      if (attempts >= retries) reject(new Error('Vite not ready'))
      else setTimeout(check, 500)
    }
    check()
  })
}

async function main() {
  console.log('Waiting for Vite dev server…')
  await waitForVite()
  console.log('Vite ready. Launching Electron…')
  const electron = require('electron')
  spawn(electron, ['.'], { stdio: 'inherit', env: { ...process.env, NODE_ENV: 'development' } })
}

main().catch(console.error)
