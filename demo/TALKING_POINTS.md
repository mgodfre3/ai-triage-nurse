# 🏥 AI Triage Nurse — Demo Talking Points
## Showcasing Foundry Local + AI on Azure Local Edge Compute

---

## 🎯 Opening Hook (30 seconds)

> "What if you could run a fully intelligent medical intake system — with real-time AI conversations, tool calling, and a 3D holographic interface — completely on-premises, with zero cloud dependency? That's what we're about to show you."

---

## 🏗️ Architecture Story (2 minutes)

### The Edge Computing Challenge
- Healthcare data is **sensitive** — HIPAA, data sovereignty, air-gapped environments
- Cloud latency is unacceptable for real-time patient interaction
- GPU availability at the edge is **limited or nonexistent**
- You still need intelligent AI capabilities

### How We Solve It
- **Azure Local** provides the hybrid cloud infrastructure
- **Arc-enabled AKS** gives us Kubernetes at the edge, managed from Azure
- **Foundry Local** (via Ollama) runs **qwen2.5:3b** — a 3-billion parameter model that runs on **CPU only** — no GPU required
- The entire stack runs on **two nodes** in a Denver data center with ~6GB of RAM for inference

### Key Talking Points
| Component | What It Does | Why It Matters |
|-----------|-------------|----------------|
| **Azure Local** | Hybrid cloud hardware | Data stays on-prem, managed from Azure |
| **Arc-enabled AKS** | Kubernetes at the edge | Same K8s experience, edge or cloud |
| **Foundry Local / Ollama** | Local LLM inference | No internet needed, sub-second responses |
| **qwen2.5:3b** | Small language model | Runs on CPU, fits in 6GB RAM |
| **FastAPI + WebSocket** | Real-time chat backend | Streaming responses, instant feel |
| **Three.js hologram** | 3D medical AI avatar | Visual engagement, "wow factor" |

---

## 💡 Key Messages to Land

### 1. "AI at the Edge is Real — Today"
- This isn't a concept or roadmap item. It's running right now on physical hardware in Denver.
- The model fits in memory alongside the application workload.
- Inference happens in seconds, not minutes.

### 2. "No GPU? No Problem."
- qwen2.5:3b is designed for CPU-only inference
- 3 billion parameters delivers surprisingly capable conversation
- Tool calling works — the model can fill structured forms in real-time
- This proves you don't need an A100 to run useful AI workloads

### 3. "Data Never Leaves the Building"
- Zero external API calls for inference
- Patient data stays on the local cluster
- Perfect for HIPAA, FedRAMP, air-gapped, and classified environments
- Audit trail is fully local

### 4. "Same Developer Experience, Anywhere"
- The same container image runs on any Kubernetes cluster
- OpenAI-compatible API (AsyncOpenAI client) — swap to cloud OpenAI with one env var
- Flux GitOps handles deployments — push to main, cluster updates automatically
- Arc gives you single-pane-of-glass management from Azure Portal

### 5. "From Prototype to Production in Hours, Not Months"
- This entire demo was built and deployed to a real edge cluster rapidly
- Docker build → GHCR push → kubectl deploy
- No special drivers, no CUDA setup, no GPU allocation drama

---

## 🎪 Live Demo Script (5-7 minutes)

### Act 1: Show the Architecture (1 min)
1. Open Azure Portal → show the **den-geoint** Arc-enabled cluster
2. Point out it's an **Azure Local** cluster, not cloud AKS
3. Show the `ai-triage-nurse` namespace with running pods:
   - `ai-triage-nurse` — the FastAPI app (2-4GB RAM)
   - `ollama` — the inference engine with qwen2.5:3b (4-6GB RAM)
4. "Two pods, two nodes, zero GPUs. That's the whole stack."

### Act 2: Meet Nurse Ada (3-4 min)
1. Navigate to `http://172.22.84.49:30080`
2. Point out the **holographic AI avatar** — "This is Nurse Ada, our AI triage nurse"
3. Note the medical hologram design: orbiting health icons, EKG pulse line, glowing core
4. Start a conversation:

**Suggested patient scenario:**
```
You: "Hi, I'm here because I've been having chest pain"
```
> Watch the hologram react — it spins faster when "speaking"
> Point out the form auto-filling on the right panel

```
Ada: [Greets, asks for name]
You: "My name is John Smith"
```
> Show the intake form updating in real-time via tool calls

```
Ada: [Asks about symptoms]
You: "It started about 2 hours ago. Sharp pain in my left side, 
      gets worse when I breathe deeply. Pain is about a 7 out of 10."
```
> Highlight: The AI asked ONE focused question at a time
> Show the chief complaint, duration, and pain level populating

Continue through allergies, medications, medical history...

### Act 3: The Triage Decision (1 min)
Once enough info is gathered, the AI will:
- Assign a **triage priority** (green/yellow/orange/red)
- The form panel updates with the priority color
- Emphasize: "The AI made a structured clinical decision, on local hardware, in real-time"

### Act 4: Under the Hood (1 min)
Pull up the browser console (F12) or terminal:
```bash
kubectl logs -f deployment/ai-triage-nurse -n ai-triage-nurse
```
Show the real-time WebSocket messages, tool calls being parsed, Ollama inference happening locally.

---

## ❓ Anticipated Questions & Answers

### "How fast is inference without a GPU?"
Responses stream in 2-5 seconds on CPU. For an interactive chat, that's perfectly acceptable. The WebSocket streaming makes it feel even faster since tokens appear as they're generated.

### "Could this run in a disconnected / air-gapped environment?"
Absolutely. Once the model is cached locally, zero internet is needed. The Ollama container pulls the model on first start, then it's cached in a PV. In a real air-gap, you'd pre-load the model into the container image.

### "What about larger models?"
If you have GPU nodes (even a T4), you can run 7B-13B parameter models via KAITO. We actually have a KAITO Phi-4 workspace definition ready. The architecture scales up — same API, just swap the model name.

### "Is this production-ready?"
This is a demo, but the patterns are production-grade: health probes, resource limits, GitOps deployment, structured logging, graceful shutdown. Add TLS termination, auth, and persistent storage and you're there.

### "What other use cases fit this pattern?"
- **Document classification** at the edge (legal, insurance, medical records)
- **Real-time translation** for field operations
- **Predictive maintenance** chatbot for manufacturing equipment
- **Security incident triage** for SOC analysts
- **Form-filling assistants** for any intake process (immigration, insurance, HR)

---

## 📊 Architecture Diagram (use with Mermaid renderer)

See `architecture.md` in this folder for a Mermaid diagram.

---

## 🔥 Closing Statement

> "We just ran a real-time AI medical intake conversation — with structured data extraction, tool calling, and a holographic interface — entirely on two edge nodes with no GPU and no cloud dependency. This is what Foundry Local on Azure Local makes possible. The future of AI isn't just in the cloud — it's everywhere your data needs to be."

---

## 📋 Pre-Demo Checklist

- [ ] Arc proxy running: `az connectedk8s proxy --name den-geoint --resource-group acx-geoint-demo`
- [ ] Verify pods healthy: `kubectl get pods -n ai-triage-nurse`
- [ ] Open browser to `http://172.22.84.49:30080`
- [ ] Test a quick chat message to warm up the model
- [ ] Have Azure Portal open to the den-geoint cluster page
- [ ] Browser dev tools closed (open only if showing logs)
- [ ] Clear any previous chat session (refresh page)
