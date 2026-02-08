<div align="center">

# Pitchly

### Your AI-Powered Pitch Coach, Right on Your Desktop.

**Real-time vocal analysis · Live coaching feedback · Post-session summaries**

[![Electron](https://img.shields.io/badge/Electron-40.x-47848F?logo=electron&logoColor=white)](https://www.electronjs.org/)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.x-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![OpenAI](https://img.shields.io/badge/OpenAI-Realtime_API-412991?logo=openai&logoColor=white)](https://platform.openai.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

<img width="720" alt="Pitchly overlays your camera feed with real-time coaching" src="ss.png">

</div>

---

## What is Pitchly?

Pitchly is a **transparent desktop overlay** that sits on top of your camera feed and gives you **real-time, AI-powered coaching** while you practice your pitch. Think of it as a teleprompter meets speech coach — it listens to your voice, analyzes your delivery, and surfaces actionable feedback *as you speak*.

> **No more guessing if you sound confident.** Pitchly tells you — in real time.

---

## How It Works

```
Microphone → PCM Audio Capture → OpenAI Realtime API → AI Coach → Live Feedback
```

1. **Audio Capture** — Captures raw PCM audio from your microphone at 24kHz via the Web Audio API
2. **Streaming Analysis** — Sends audio chunks every 2 seconds to OpenAI's Realtime API over WebSocket
3. **Vocal Intelligence** — The AI analyzes *what* you say and *how* you say it (confidence, pace, clarity, energy, filler words)
4. **Live Coaching** — Hyper-specific tips appear on-screen referencing your actual words and vocal patterns
5. **Post-Session Summary** — When you stop, Pitchly generates a full debrief with strengths, areas to improve, and an AI-written summary

---

## Features

| Feature | Description |
|---|---|
| **Real-Time Coaching** | Live tips that reference specific moments in your speech — not generic advice |
| **Signal Dashboard** | At-a-glance ratings for Confidence, Energy, Clarity, Pace, and Persuasion |
| **Pace Tracking** | Live words-per-minute calculation with a 10-second rolling window |
| **Teleprompter** | Draggable, resizable floating teleprompter with auto-scroll and speed control |
| **Video Recording** | Record your pitch session as a `.webm` file with one click |
| **Post-Session Summary** | AI-generated debrief covering transcript, feedback highlights, and actionable next steps |
| **Transparent Overlay** | Frameless, always-on-camera window — see yourself while you practice |
| **Glassmorphism UI** | Frosted glass panels that float over your camera feed without distraction |
| **Pitch Categories** | Choose between Science, Tech, and Business modes for context-aware coaching |

---

## Architecture

```
pitchly/
├── src/
│   ├── main.ts                 # Electron main process — IPC handlers, window creation
│   ├── preload.js              # Secure bridge between main & renderer
│   ├── renderer.tsx            # React entry point
│   │
│   ├── components/
│   │   ├── OverlayRoot.tsx     # Root layout — camera, top bar, controls, panels
│   │   ├── UnifiedTopBar.tsx   # Coaching display — feedback, signals, pace
│   │   ├── RecordingControls.tsx   # Start/stop recording with timer
│   │   ├── Teleprompter.tsx    # Floating teleprompter with drag/resize
│   │   ├── SettingsPanel.tsx   # Category & instruction settings
│   │   ├── SpeedIndicator.tsx  # WPM gauge visualization
│   │   ├── SignalBadge.tsx     # Individual signal pill (High/Med/Low)
│   │   ├── GlassPanel.tsx      # Reusable glassmorphism container
│   │   └── PostSessionSummary.tsx  # End-of-session debrief screen
│   │
│   ├── hooks/
│   │   └── useRealtimeAnalysis.ts  # Core hook — audio pipeline, WPM, state management
│   │
│   ├── services/
│   │   ├── realtimeService.ts  # OpenAI Realtime API WebSocket client
│   │   └── dedalusService.ts   # Dedalus Labs client for summaries & audio analysis
│   │
│   └── types/
│       └── pitch.ts            # Shared types — PitchData, CoachingTip, Signal, IPC channels
│
├── forge.config.js             # Electron Forge packaging config
├── vite.main.config.mjs        # Vite config for main process
├── vite.renderer.config.mjs    # Vite config for renderer (React)
└── vite.preload.config.mjs     # Vite config for preload script
```

---

## Getting Started

### Prerequisites

- **Node.js** ≥ 18
- **npm** ≥ 9
- An **OpenAI API key** with access to the [Realtime API](https://platform.openai.com/docs/guides/realtime)

### Installation

```bash
# Clone the repository
git clone https://github.com/your-username/pitchly.git
cd pitchly

# Install dependencies
npm install
```

### Configuration

Create a `.env` file in the project root:

```env
OPENAI_API_KEY=sk-your-openai-api-key
DEDALUS_API_KEY=your-dedalus-key  # Optional — falls back to OPENAI_API_KEY
```

### Run

```bash
npm start
```

This launches the Electron app with hot-reload via Vite. A DevTools window will open automatically in development mode.

### Build

```bash
# Package the app for your platform
npm run make
```

Produces platform-specific distributables (`.dmg` on macOS, `.exe` on Windows, `.deb`/`.rpm` on Linux) in the `out/` directory.

---

## Usage

1. **Launch Pitchly** — the app opens as a full-screen transparent overlay with your camera feed
2. **Hit Record** — click the center record button to start your pitch session
3. **Pitch naturally** — coaching tips, signal ratings, and pace tracking appear in real time
4. **Use the Teleprompter** *(optional)* — click the document icon to open a floating script viewer
5. **Stop Recording** — click stop to end the session and view your AI-generated summary
6. **Save or Discard** — download the recording or start fresh

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Desktop Runtime** | Electron 40 + Electron Forge |
| **Frontend** | React 18 + TypeScript |
| **Styling** | Tailwind CSS 3 + custom glassmorphism |
| **Build Tool** | Vite 5 (multi-target: main, preload, renderer) |
| **AI — Real-Time** | OpenAI Realtime API (WebSocket, GPT-4o) |
| **AI — Summaries** | Dedalus Labs SDK (structured output with Zod) |
| **Audio** | Web Audio API → PCM16 @ 24kHz |
| **Icons** | Lucide React |
| **Validation** | Zod |

---

## License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

---

<div align="center">

*Practice your pitch. Get better. Ship it.*

</div>
