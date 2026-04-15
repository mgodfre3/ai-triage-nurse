# Architecture Diagrams — AI Triage Nurse on Azure Local

## High-Level Architecture

```mermaid
graph TB
    subgraph "Azure Cloud"
        Portal["Azure Portal<br/>🌐 Management Plane"]
        Arc["Azure Arc<br/>🔗 Control Plane"]
        GHCR["GitHub Container Registry<br/>📦 Images"]
    end

    subgraph "Azure Local — Denver Data Center"
        subgraph "Arc-enabled AKS Cluster (den-geoint)"
            subgraph "Node 1: moc-lckra1on5o6"
                Ollama["🧠 Ollama Pod<br/>qwen2.5:3b (CPU)<br/>4-6GB RAM"]
            end
            subgraph "Node 2: moc-la77hr1e81k"
                App["🏥 AI Triage Nurse Pod<br/>FastAPI + Three.js<br/>2-4GB RAM"]
            end
            SVC["☸️ NodePort Service<br/>:30080"]
        end
    end

    subgraph "User"
        Browser["🖥️ Browser<br/>Three.js Hologram + Chat UI"]
    end

    Portal -.->|"Manage"| Arc
    Arc -.->|"GitOps / Flux"| App
    GHCR -.->|"Pull Image"| App

    Browser -->|"HTTP / WebSocket"| SVC
    SVC --> App
    App -->|"OpenAI-compatible API<br/>/v1/chat/completions"| Ollama
    
    style Portal fill:#0078d4,color:#fff
    style Arc fill:#0078d4,color:#fff
    style GHCR fill:#24292e,color:#fff
    style Ollama fill:#ff6b35,color:#fff
    style App fill:#10b981,color:#fff
    style SVC fill:#6366f1,color:#fff
    style Browser fill:#38bdf8,color:#fff
```

## Data Flow — Patient Conversation

```mermaid
sequenceDiagram
    participant P as 👤 Patient (Browser)
    participant H as 🌀 3D Hologram
    participant WS as ⚡ WebSocket
    participant BE as 🏥 FastAPI Backend
    participant AI as 🧠 Ollama (qwen2.5:3b)

    P->>WS: "Hi, I have chest pain"
    WS->>BE: message via WebSocket
    
    BE->>AI: POST /v1/chat/completions<br/>(system prompt + tools + history)
    
    Note over AI: CPU inference<br/>~2-5 seconds<br/>No GPU needed
    
    AI-->>BE: Streaming tokens + tool calls
    
    BE-->>WS: 🔧 tool_call: update_intake_form<br/>{chief_complaint: "chest pain"}
    WS-->>P: Form updates in real-time
    WS-->>H: nurseIsSpeaking = true
    
    Note over H: Hologram spins faster<br/>Core glows brighter

    BE-->>WS: 💬 "I'm sorry to hear that.<br/>Can you tell me your name?"
    WS-->>P: Chat bubble appears
    WS-->>H: nurseIsSpeaking = false
    
    Note over H: Hologram returns<br/>to idle animation
```

## Component Stack

```mermaid
graph LR
    subgraph "Frontend (Browser)"
        UI["Chat UI<br/>HTML/CSS/JS"]
        TJS["Three.js r128<br/>3D Hologram"]
        WS1["WebSocket Client"]
    end

    subgraph "Backend Pod"
        FA["FastAPI<br/>Python 3.11"]
        TE["Triage Engine<br/>Tool Call Parser"]
        FM["Foundry Manager<br/>AsyncOpenAI Client"]
    end

    subgraph "Inference Pod"
        OL["Ollama Server"]
        QW["qwen2.5:3b<br/>3B params, CPU"]
    end

    UI --> WS1
    TJS --> UI
    WS1 -->|"WebSocket"| FA
    FA --> TE
    TE --> FM
    FM -->|"OpenAI API"| OL
    OL --> QW

    style UI fill:#38bdf8,color:#000
    style TJS fill:#22d3ee,color:#000
    style FA fill:#10b981,color:#fff
    style TE fill:#059669,color:#fff
    style FM fill:#047857,color:#fff
    style OL fill:#ff6b35,color:#fff
    style QW fill:#ea580c,color:#fff
```

## Edge vs Cloud — Why This Matters

```mermaid
graph TB
    subgraph "Traditional Cloud AI"
        C1["Patient Data"] -->|"🌐 Internet"| C2["Cloud API<br/>(OpenAI, Azure OpenAI)"]
        C2 -->|"🌐 Internet"| C3["Response"]
        style C1 fill:#ef4444,color:#fff
        style C2 fill:#f59e0b,color:#000
        style C3 fill:#ef4444,color:#fff
    end

    subgraph "Foundry Local on Azure Local"
        E1["Patient Data"] -->|"🔒 Local Network"| E2["Ollama on AKS<br/>(On-Prem)"]
        E2 -->|"🔒 Local Network"| E3["Response"]
        style E1 fill:#10b981,color:#fff
        style E2 fill:#10b981,color:#fff
        style E3 fill:#10b981,color:#fff
    end

    C1 -.->|"❌ Data leaves building<br/>❌ Internet dependency<br/>❌ Latency 100-500ms<br/>❌ Per-token cost"| C2
    E1 -.->|"✅ Data stays local<br/>✅ No internet needed<br/>✅ Latency 2-5s total<br/>✅ Zero marginal cost"| E2
```

## Kubernetes Resource Layout

```mermaid
graph TB
    subgraph "Namespace: ai-triage-nurse"
        D1["Deployment<br/>ai-triage-nurse"]
        D2["Deployment<br/>ollama"]
        S1["Service: NodePort<br/>30080 → 8080"]
        S2["Service: ClusterIP<br/>ollama:11434"]
        P1["Pod: ai-triage-nurse<br/>CPU: 0.5-2 cores<br/>RAM: 2-4 GB"]
        P2["Pod: ollama<br/>CPU: 0.25-4 cores<br/>RAM: 0.5-6 GB"]
    end

    D1 --> P1
    D2 --> P2
    S1 --> P1
    S2 --> P2
    P1 -->|"HTTP"| S2

    style D1 fill:#6366f1,color:#fff
    style D2 fill:#6366f1,color:#fff
    style S1 fill:#8b5cf6,color:#fff
    style S2 fill:#8b5cf6,color:#fff
    style P1 fill:#10b981,color:#fff
    style P2 fill:#ff6b35,color:#fff
```
