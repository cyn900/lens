require('dotenv').config()
const { app, BrowserWindow, ipcMain, desktopCapturer, screen, globalShortcut } = require('electron')
const { createWorker } = require('tesseract.js')
const OpenAI = require('openai')
const Anthropic = require('@anthropic-ai/sdk')
const keytar = require('keytar')

const KEYTAR_SERVICE = 'lens-app'
const KEYTAR_ACCOUNTS = { openai: 'openai-key', anthropic: 'anthropic-key' }

// Keychain helpers
async function saveKey(provider, value) {
  if (value) {
    await keytar.setPassword(KEYTAR_SERVICE, KEYTAR_ACCOUNTS[provider], value)
  } else {
    await keytar.deletePassword(KEYTAR_SERVICE, KEYTAR_ACCOUNTS[provider])
  }
}

async function loadKey(provider) {
  return await keytar.getPassword(KEYTAR_SERVICE, KEYTAR_ACCOUNTS[provider]) || ''
}

// electron-store v8 is ESM-only, use dynamic import
let store
async function getStore() {
  if (!store) {
    const { default: Store } = await import('electron-store')
    store = new Store({
      defaults: {
        provider: 'openai',
        ollamaUrl: 'http://localhost:11434',
        openaiModel: 'gpt-4o',
        anthropicModel: 'claude-3-5-haiku-20241022',
        ollamaModel: 'llama3.2',
        customPrompts: {
          simplify: 'Explain the following text in simple, plain language that anyone can understand. Be concise.\n\n"{text}"',
          translate: 'Translate and simplify the following text into plain English. If it\'s already English, just simplify it.\n\n"{text}"',
          summarize: 'Summarize the following text in 2-3 short sentences.\n\n"{text}"',
          define: 'Identify the most complex or technical terms in the following text and briefly explain each one in plain language.\n\n"{text}"'
        }
      }
    })
  }
  return store
}

let win
let ocrWorker

async function initOCR() {
  ocrWorker = await createWorker('eng')
}

function createWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize

  win = new BrowserWindow({
    width: 520,
    height: 480,
    x: Math.floor(width / 2 - 260),
    y: Math.floor(height / 2 - 240),
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    hasShadow: false,
    resizable: true,
    webPreferences: {
      preload: `${__dirname}/preload.js`,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  win.loadFile('renderer/index.html')
  win.setIgnoreMouseEvents(false)
}

async function captureRegion() {
  const bounds = win.getBounds()
  const primaryDisplay = screen.getPrimaryDisplay()
  const scaleFactor = primaryDisplay.scaleFactor

  win.hide()
  await new Promise(r => setTimeout(r, 150))

  const sources = await desktopCapturer.getSources({
    types: ['screen'],
    thumbnailSize: {
      width: Math.floor(primaryDisplay.size.width * scaleFactor),
      height: Math.floor(primaryDisplay.size.height * scaleFactor)
    }
  })

  win.show()

  const cropped = sources[0].thumbnail.crop({
    x: Math.floor(bounds.x * scaleFactor),
    y: Math.floor(bounds.y * scaleFactor),
    width: Math.floor(bounds.width * scaleFactor),
    height: Math.floor(bounds.height * scaleFactor)
  })

  return cropped.toDataURL()
}

async function callLLM(prompt, cfg) {
  if (cfg.provider === 'openai') {
    const client = new OpenAI({ apiKey: cfg.openaiKey })
    const res = await client.chat.completions.create({
      model: cfg.openaiModel || 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 400
    })
    return res.choices[0].message.content

  } else if (cfg.provider === 'anthropic') {
    const client = new Anthropic({ apiKey: cfg.anthropicKey })
    const res = await client.messages.create({
      model: cfg.anthropicModel || 'claude-3-5-haiku-20241022',
      max_tokens: 400,
      messages: [{ role: 'user', content: prompt }]
    })
    return res.content[0].text

  } else if (cfg.provider === 'ollama') {
    const baseURL = (cfg.ollamaUrl || 'http://localhost:11434') + '/v1'
    const client = new OpenAI({ apiKey: 'ollama', baseURL })
    const res = await client.chat.completions.create({
      model: cfg.ollamaModel || 'llama3.2',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 400
    })
    return res.choices[0].message.content
  }

  throw new Error('Unknown provider: ' + cfg.provider)
}

// Settings IPC
ipcMain.handle('get-settings', async () => {
  const s = await getStore()
  const [openaiKey, anthropicKey] = await Promise.all([
    loadKey('openai'),
    loadKey('anthropic')
  ])
  return { ...s.store, openaiKey, anthropicKey }
})

ipcMain.handle('save-settings', async (_, settings) => {
  const s = await getStore()
  // Save keys to keychain, everything else to store
  await Promise.all([
    saveKey('openai', settings.openaiKey),
    saveKey('anthropic', settings.anthropicKey)
  ])
  const { openaiKey, anthropicKey, ...rest } = settings
  s.set(rest)
  return true
})

// Main capture + process
ipcMain.handle('capture-and-process', async (_, mode) => {
  try {
    const s = await getStore()
    const cfg = s.store
    const [openaiKey, anthropicKey] = await Promise.all([
      loadKey('openai'),
      loadKey('anthropic')
    ])

    const key = cfg.provider === 'openai' ? openaiKey
              : cfg.provider === 'anthropic' ? anthropicKey
              : 'ollama'

    if (cfg.provider !== 'ollama' && !key) {
      return { error: `No API key set for ${cfg.provider}. Open Settings to add one.` }
    }

    const dataUrl = await captureRegion()
    const { data: { text } } = await ocrWorker.recognize(dataUrl)
    const cleanText = text.trim()

    if (!cleanText || cleanText.length < 5) {
      return { error: 'No readable text found in this area.' }
    }

    const promptTemplate = cfg.customPrompts?.[mode] || cfg.customPrompts?.simplify
    const prompt = promptTemplate.replace('{text}', cleanText)

    const result = await callLLM(prompt, { ...cfg, openaiKey, anthropicKey })
    return { original: cleanText, result }

  } catch (err) {
    return { error: err.message }
  }
})

ipcMain.on('close-app', () => app.quit())
ipcMain.on('set-clickthrough', (_, value) => {
  win.setIgnoreMouseEvents(value, { forward: true })
})

app.whenReady().then(async () => {
  await initOCR()
  createWindow()

  globalShortcut.register('CommandOrControl+Shift+L', () => {
    win.webContents.send('trigger-capture')
  })
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
  if (ocrWorker) ocrWorker.terminate()
})

app.on('window-all-closed', () => app.quit())
