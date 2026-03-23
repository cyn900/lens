# ⬡ Lens

A transparent desktop overlay that reads any text on your screen and explains it in plain language using AI.

Position the window over anything — a legal document, medical report, academic paper, dense UI — press **Scan**, and get a simplified explanation instantly.

---

## What it does

- Sits transparently on top of any app or window
- Captures the text beneath it using OCR
- Sends it to an AI model to simplify, translate, summarize, or define
- Shows the result as an overlay — no copy-pasting, no switching apps

---

## Setup

Prerequisites: Node.js v18+

```bash
git clone https://github.com/cyn900/lens.git
cd lens
npm install
npm start
```

On first launch, the Settings panel opens automatically.

---

## Configuring your AI provider

Open Settings (⚙ in the top right) and choose one of three providers:

**OpenAI**
- Get an API key at [platform.openai.com](https://platform.openai.com)
- Default model: `gpt-4o` (use `gpt-4o-mini` for lower cost)

**Anthropic (Claude)**
- Get an API key at [console.anthropic.com](https://console.anthropic.com)
- Default model: `claude-3-5-haiku-20241022`

**Ollama — fully local, no API key needed**
- Install from [ollama.com](https://ollama.com)
- Pull a model: `ollama pull llama3.2`
- Default URL: `http://localhost:11434`
- Runs entirely on your machine using the GPU / Neural Engine on Apple Silicon

---

## How to use

1. Launch the app with `npm start`
2. Drag the Lens window over any text on screen
3. Pick a mode from the top bar — Simplify, Translate, Summarize, or Define
4. Press **Scan** or hit `Cmd+Shift+L` (macOS) / `Ctrl+Shift+L` (Windows / Linux)
5. The app briefly hides, captures what's beneath, runs OCR, calls the AI, then shows the result
6. Hit **Copy** to copy the result to clipboard

---

## Modes

| Mode | What it does |
|------|--------------|
| Simplify | Rewrites complex text in plain language |
| Translate | Translates and simplifies into plain English |
| Summarize | Condenses into 2–3 sentences |
| Define Terms | Explains the most complex words and phrases |

You can edit the prompt for each mode in Settings — use `{text}` as the placeholder for the captured content.

---

## Permissions

**macOS** requires Screen Recording permission to capture what's beneath the window.

Go to: System Settings → Privacy & Security → Screen Recording → enable your terminal or the Lens app.

**Windows / Linux** — no special permissions needed.

---

## License

[MIT](./LICENSE)
