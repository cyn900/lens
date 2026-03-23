// ── DOM refs ──────────────────────────────────────────────────────────────────
const scanBtn         = document.getElementById('scan-btn')
const closeBtn        = document.getElementById('close-btn')
const settingsBtn     = document.getElementById('settings-btn')
const providerBadge   = document.getElementById('provider-badge')
const modePills       = document.querySelectorAll('.mode-pill')
const loadingLabel    = document.getElementById('loading-label')
const loadingSub      = document.getElementById('loading-sub')

const idleState       = document.getElementById('idle-state')
const loadingState    = document.getElementById('loading-state')
const resultState     = document.getElementById('result-state')
const errorState      = document.getElementById('error-state')

const resultText      = document.getElementById('result-text')
const errorText       = document.getElementById('error-text')
const copyBtn         = document.getElementById('copy-btn')
const rescanBtn       = document.getElementById('rescan-btn')
const retryBtn        = document.getElementById('retry-btn')

// Settings
const settingsPanel     = document.getElementById('settings-panel')
const settingsCloseBtn  = document.getElementById('settings-close-btn')
const saveSettingsBtn   = document.getElementById('save-settings-btn')
const resetPromptBtn    = document.getElementById('reset-prompt-btn')
const openSettingsErr   = document.getElementById('open-settings-from-error')
const providerCards     = document.querySelectorAll('.provider-card')

const sOpenaiKey      = document.getElementById('s-openai-key')
const sOpenaiModel    = document.getElementById('s-openai-model')
const sAnthropicKey   = document.getElementById('s-anthropic-key')
const sAnthropicModel = document.getElementById('s-anthropic-model')
const sOllamaUrl      = document.getElementById('s-ollama-url')
const sOllamaModel    = document.getElementById('s-ollama-model')
const sPrompt         = document.getElementById('s-prompt')
const ptabs           = document.querySelectorAll('.ptab')

// ── State ─────────────────────────────────────────────────────────────────────
const defaultPrompts = {
  simplify:  'Explain the following text in simple, plain language that anyone can understand. Be concise.\n\n"{text}"',
  translate: 'Translate and simplify the following text into plain English. If it\'s already English, just simplify it.\n\n"{text}"',
  summarize: 'Summarize the following text in 2-3 short sentences.\n\n"{text}"',
  define:    'Identify the most complex or technical terms in the following text and briefly explain each one in plain language.\n\n"{text}"'
}

const providerLabels = { openai: 'OpenAI', anthropic: 'Claude', ollama: 'Ollama' }

let currentMode       = 'simplify'
let activePromptMode  = 'simplify'
let pendingPrompts    = {}
let selectedProvider  = 'openai'

// ── Helpers ───────────────────────────────────────────────────────────────────
function showState(state) {
  [idleState, loadingState, resultState, errorState].forEach(s => s.classList.add('hidden'))
  state.classList.remove('hidden')
}

function setProviderBadge(provider) {
  providerBadge.textContent = providerLabels[provider] || provider
}

// ── Mode pills ────────────────────────────────────────────────────────────────
modePills.forEach(pill => {
  pill.addEventListener('click', () => {
    modePills.forEach(p => p.classList.remove('active'))
    pill.classList.add('active')
    currentMode = pill.dataset.mode
  })
})

// ── Result tabs ───────────────────────────────────────────────────────────────

// ── Copy button ───────────────────────────────────────────────────────────────
copyBtn.addEventListener('click', () => {
  const text = resultText.textContent
  if (!text) return
  navigator.clipboard.writeText(text).then(() => {
    copyBtn.classList.add('copied')
    copyBtn.querySelector('svg').style.display = 'none'
    copyBtn.childNodes[copyBtn.childNodes.length - 1].textContent = ' Copied'
    setTimeout(() => {
      copyBtn.classList.remove('copied')
      copyBtn.querySelector('svg').style.display = ''
      copyBtn.childNodes[copyBtn.childNodes.length - 1].textContent = ' Copy'
    }, 1800)
  })
})

// ── Scan ──────────────────────────────────────────────────────────────────────
const loadingSteps = [
  ['Capturing screen…', 'Hiding window briefly'],
  ['Running OCR…', 'Extracting text'],
  ['Thinking…', 'Calling AI model'],
]
let loadingStepIndex = 0
let loadingTimer = null

function startLoadingAnimation() {
  loadingStepIndex = 0
  updateLoadingStep()
  loadingTimer = setInterval(() => {
    loadingStepIndex = (loadingStepIndex + 1) % loadingSteps.length
    updateLoadingStep()
  }, 1800)
}

function updateLoadingStep() {
  const [label, sub] = loadingSteps[loadingStepIndex]
  loadingLabel.textContent = label
  loadingSub.textContent = sub
}

function stopLoadingAnimation() {
  clearInterval(loadingTimer)
}

async function runScan() {
  scanBtn.disabled = true
  startLoadingAnimation()
  showState(loadingState)

  const response = await window.lens.captureAndProcess(currentMode)
  stopLoadingAnimation()

  if (response.error) {
    errorText.textContent = response.error
    showState(errorState)
  } else {
    resultText.textContent = response.result
    showState(resultState)
  }

  scanBtn.disabled = false
}

scanBtn.addEventListener('click', runScan)
rescanBtn.addEventListener('click', runScan)
retryBtn.addEventListener('click', runScan)
closeBtn.addEventListener('click', () => window.lens.closeApp())
window.lens.onTriggerCapture(() => runScan())

// ── Settings ──────────────────────────────────────────────────────────────────
function setActiveProviderCard(provider) {
  selectedProvider = provider
  providerCards.forEach(c => c.classList.toggle('active', c.dataset.provider === provider))
  document.querySelectorAll('.provider-section').forEach(s => s.classList.add('hidden'))
  const el = document.getElementById(`section-${provider}`)
  if (el) el.classList.remove('hidden')
}

providerCards.forEach(card => {
  card.addEventListener('click', () => setActiveProviderCard(card.dataset.provider))
})

async function openSettings() {
  const s = await window.lens.getSettings()
  pendingPrompts = { ...defaultPrompts, ...(s.customPrompts || {}) }

  setActiveProviderCard(s.provider || 'openai')
  sOpenaiKey.value      = s.openaiKey || ''
  sOpenaiModel.value    = s.openaiModel || 'gpt-4o'
  sAnthropicKey.value   = s.anthropicKey || ''
  sAnthropicModel.value = s.anthropicModel || 'claude-3-5-haiku-20241022'
  sOllamaUrl.value      = s.ollamaUrl || 'http://localhost:11434'
  sOllamaModel.value    = s.ollamaModel || 'llama3.2'

  setActivePromptTab('simplify')
  settingsPanel.classList.remove('hidden')
}

function closeSettings() {
  settingsPanel.classList.add('hidden')
}

function setActivePromptTab(mode) {
  activePromptMode = mode
  ptabs.forEach(t => t.classList.toggle('active', t.dataset.mode === mode))
  sPrompt.value = pendingPrompts[mode] || defaultPrompts[mode]
}

sPrompt.addEventListener('input', () => {
  pendingPrompts[activePromptMode] = sPrompt.value
})

ptabs.forEach(tab => {
  tab.addEventListener('click', () => {
    pendingPrompts[activePromptMode] = sPrompt.value
    setActivePromptTab(tab.dataset.mode)
  })
})

resetPromptBtn.addEventListener('click', () => {
  pendingPrompts[activePromptMode] = defaultPrompts[activePromptMode]
  sPrompt.value = defaultPrompts[activePromptMode]
})

saveSettingsBtn.addEventListener('click', async () => {
  pendingPrompts[activePromptMode] = sPrompt.value

  await window.lens.saveSettings({
    provider:       selectedProvider,
    openaiKey:      sOpenaiKey.value.trim(),
    openaiModel:    sOpenaiModel.value.trim() || 'gpt-4o',
    anthropicKey:   sAnthropicKey.value.trim(),
    anthropicModel: sAnthropicModel.value.trim() || 'claude-3-5-haiku-20241022',
    ollamaUrl:      sOllamaUrl.value.trim() || 'http://localhost:11434',
    ollamaModel:    sOllamaModel.value.trim() || 'llama3.2',
    customPrompts:  pendingPrompts
  })

  setProviderBadge(selectedProvider)

  const orig = saveSettingsBtn.innerHTML
  saveSettingsBtn.innerHTML = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg> Saved'
  setTimeout(() => {
    saveSettingsBtn.innerHTML = orig
    closeSettings()
  }, 900)
})

settingsBtn.addEventListener('click', openSettings)
settingsCloseBtn.addEventListener('click', closeSettings)
openSettingsErr.addEventListener('click', openSettings)

// ── Reveal password toggle ────────────────────────────────────────────────────
document.querySelectorAll('.reveal-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const input = document.getElementById(btn.dataset.target)
    input.type = input.type === 'password' ? 'text' : 'password'
  })
})

// ── Init ──────────────────────────────────────────────────────────────────────
;(async () => {
  const s = await window.lens.getSettings()
  setProviderBadge(s.provider || 'openai')
  const needsSetup = s.provider !== 'ollama' && !s.openaiKey && !s.anthropicKey
  if (needsSetup) openSettings()
})()
