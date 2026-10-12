# Smart Command Center

An edge-orchestrated, multi-layered smart home command center built with React Native (Expo) and TypeScript. Designed for high resilience, offline AST-based automation evaluation, real-time WebSocket protocol translation, and local SQLite persistence.

---

## Architecture Overview

The system is organized into a clean 5-layer decoupled pipeline:

```
[ Layer 1: Network Driver ]       --> HomeAssistantSocket (WebSocket lifecycle & frames)
        │
[ Layer 2: Protocol Translator ]  --> Normalizes raw events into universal DeviceState domain models
        │
[ Layer 3: Persistence Engine ]   --> WAL-mode SQLite storage (expo-sqlite) with web fallback
        │
[ Layer 4: AST Rule Engine ]      --> Evaluates conditional graphs (Triggers -> Operators -> Actions)
        │
[ Layer 5: Reactive UI Canvas ]   --> Mobile dark-mode canvas, live event bus, dynamic rule builder
```

### Key Modules

* **Layer 1: Network Socket Driver (`src/network/HomeAssistantSocket.ts`)**  
  Bidirectional WebSocket manager with automatic authentication handshake, heartbeat resilience, connection state reporting, and remote service calling.

* **Layer 2: Protocol Translator / Normalizer (`src/network/HomeAssistantSocket.ts`)**  
  Ingests heterogeneous incoming JSON frames (`state_changed`, entity payloads) and normalizes them into clean, universal domain objects (`DeviceState`).

* **Layer 3: Time-Series & Persistence Engine (`src/storage/Database.ts`)**  
  Operates on-device SQLite storage using `expo-sqlite` for state snapshots and historical telemetry logging, equipped with browser-safe lazy-loading runtime fallbacks.

* **Layer 4: AST Automation Rule Engine (`src/engine/RuleEngine.ts`)**  
  Evaluates triggers and conditional expression graphs (e.g. `LESS_THAN`, threshold comparisons) without external cloud round-trips.

* **Layer 5: Reactive UI Canvas (`src/App.tsx`)**  
  Native mobile interface featuring live device cards, telemetry adjustment controls, dynamic rule builder modals, active/mute toggles, rule deletion, and an automated event bus log stream.

---

## Tech Stack

* **Framework:** React Native, Expo SDK
* **Language:** TypeScript
* **State & Persistence:** React Hooks, `expo-sqlite`
* **Transport:** WebSockets (`ws`, `isomorphic-ws`)
* **CI/CD:** GitHub Actions (macOS runner), Expo Application Services (EAS CLI)

---

## Development & Local Testing

### Prerequisi