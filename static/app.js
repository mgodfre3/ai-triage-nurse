/* ==========================================================
   AI Triage Nurse — Frontend Client
   ========================================================== */

(function () {
  "use strict";

  /* ---------- globals ---------- */
  let ws = null;
  let reconnectDelay = 1000;
  let currentAssistantBubble = null;
  let speakingTimeout = null;
  let mediaRecorder = null;
  let audioChunks = [];

  window.nurseIsSpeaking = false;

  /* =====================================================
     1. WebSocket
     ===================================================== */
  function connectWebSocket() {
    const proto = location.protocol === "https:" ? "wss" : "ws";
    ws = new WebSocket(`${proto}://${location.host}/ws`);

    ws.addEventListener("open", () => {
      console.log("[ws] connected");
      reconnectDelay = 1000;
    });

    ws.addEventListener("message", (evt) => {
      let msg;
      try { msg = JSON.parse(evt.data); } catch { return; }
      handleServerMessage(msg);
    });

    ws.addEventListener("close", () => {
      console.warn("[ws] closed — reconnecting in", reconnectDelay, "ms");
      setTimeout(connectWebSocket, reconnectDelay);
      reconnectDelay = Math.min(reconnectDelay * 2, 10000);
    });

    ws.addEventListener("error", () => ws.close());
  }

  function handleServerMessage(msg) {
    const d = msg.data || {};
    switch (msg.type) {
      case "chat_token":
        handleChatToken(d.token);
        break;
      case "thinking":
        handleThinking(d.active);
        break;
      case "form_update":
        updateFormField(d.field_path, d.value, d.display_label);
        break;
      case "triage_set":
        setTriagePriority(d.level, d.reasoning);
        break;
      case "session_reset":
        resetUI();
        break;
      case "error":
        showToast(d.message || "An error occurred");
        break;
    }
  }

  /* ---------- thinking indicator ---------- */
  function handleThinking(active) {
    if (active) {
      setNurseActivity("thinking");
      // Show a typing indicator bubble
      if (!document.getElementById("thinking-indicator")) {
        const el = document.createElement("div");
        el.id = "thinking-indicator";
        el.className = "msg-bubble assistant thinking";
        el.innerHTML = '<span class="dot-pulse"><span>.</span><span>.</span><span>.</span></span>';
        document.getElementById("chat-messages").appendChild(el);
        scrollChat();
      }
    } else {
      // Remove thinking indicator when response starts
      const el = document.getElementById("thinking-indicator");
      if (el) el.remove();
    }
  }

  /* ---------- chat_token streaming ---------- */
  function handleChatToken(token) {
    if (!currentAssistantBubble) {
      currentAssistantBubble = addMessageBubble("assistant", "");
    }
    currentAssistantBubble.textContent += token;
    scrollChat();

    window.nurseIsSpeaking = true;
    setNurseActivity("speaking");
    clearTimeout(speakingTimeout);
    speakingTimeout = setTimeout(() => {
      window.nurseIsSpeaking = false;
      setNurseActivity("idle");
      currentAssistantBubble = null;
    }, 500);
  }

  /* =====================================================
     2. Chat Functions
     ===================================================== */
  function sendMessage(text) {
    text = text.trim();
    if (!text) return;
    addMessageBubble("user", text);
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "chat", text }));
    }
    document.getElementById("chat-input").value = "";
  }

  function resetSession() {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "reset" }));
    }
  }

  function resetUI() {
    document.getElementById("chat-messages").innerHTML = "";
    currentAssistantBubble = null;
    document.querySelectorAll(".field-value").forEach((el) => (el.textContent = "—"));
    document.getElementById("triage-level").textContent = "Pending";
    document.getElementById("triage-reasoning").textContent = "Awaiting assessment…";
    const badge = document.getElementById("triage-badge");
    badge.className = "triage-badge";
  }

  /* =====================================================
     3. DOM Rendering Helpers
     ===================================================== */
  function addMessageBubble(role, text) {
    const area = document.getElementById("chat-messages");
    const div = document.createElement("div");
    div.className = `message-bubble ${role}`;
    div.textContent = text;
    area.appendChild(div);
    scrollChat();
    return div;
  }

  function scrollChat() {
    const area = document.getElementById("chat-messages");
    area.scrollTop = area.scrollHeight;
  }

  function updateFormField(fieldPath, value) {
    const el = document.querySelector(`.form-field[data-field="${fieldPath}"]`);
    if (!el) return;
    const valSpan = el.querySelector(".field-value");
    if (valSpan) {
      const display = Array.isArray(value) ? value.join(", ") : (value ?? "—");
      valSpan.textContent = display || "—";
    }
    el.classList.add("updated");
    setTimeout(() => el.classList.remove("updated"), 1500);
  }

  function setTriagePriority(level, reasoning) {
    const badge = document.getElementById("triage-badge");
    const lvlEl = document.getElementById("triage-level");
    const reasonEl = document.getElementById("triage-reasoning");

    badge.className = "triage-badge";
    if (level) badge.classList.add(level.toLowerCase());
    lvlEl.textContent = level || "Pending";
    reasonEl.textContent = reasoning || "";

    // celebration pulse
    badge.classList.add("pulse");
    setTimeout(() => badge.classList.remove("pulse"), 700);
  }

  function showToast(message) {
    const container = document.getElementById("toast-container");
    const t = document.createElement("div");
    t.className = "toast";
    t.textContent = message;
    container.appendChild(t);
    setTimeout(() => t.remove(), 3500);
  }

  /* =====================================================
     4. Voice Recording
     ===================================================== */
  function toggleRecording() {
    const btn = document.getElementById("btn-mic");
    if (mediaRecorder && mediaRecorder.state === "recording") {
      mediaRecorder.stop();
      btn.classList.remove("recording");
      return;
    }

    navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
      const mimeType = MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : "audio/ogg";
      mediaRecorder = new MediaRecorder(stream, { mimeType });
      audioChunks = [];

      mediaRecorder.addEventListener("dataavailable", (e) => {
        if (e.data.size > 0) audioChunks.push(e.data);
      });

      mediaRecorder.addEventListener("stop", () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(audioChunks, { type: mimeType });
        transcribeAudio(blob);
      });

      mediaRecorder.start();
      btn.classList.add("recording");
    }).catch((err) => {
      showToast("Microphone access denied");
      console.error(err);
    });
  }

  async function transcribeAudio(blob) {
    try {
      const form = new FormData();
      form.append("file", blob, "recording.webm");
      const res = await fetch("/transcribe", { method: "POST", body: form });
      if (!res.ok) throw new Error("Transcription failed");
      const data = await res.json();
      if (data.text) sendMessage(data.text);
    } catch (err) {
      showToast("Voice transcription failed");
      console.error(err);
    }
  }

  /* =====================================================
     5. Three.js — Nurse Avatar (GLTF model + procedural fallback)
     ===================================================== */
  let nurseGroup; // 3D hologram group

  // Status indicator helpers
  function setNurseActivity(state, text) {
    const dot = document.getElementById("activity-dot");
    const txt = document.getElementById("activity-text");
    const labels = { idle: "Ready", speaking: "Speaking…", thinking: "Thinking…" };
    if (dot) { dot.className = "dot " + state; }
    if (txt) { txt.textContent = text || labels[state] || state; }
    // Drive GLTF model animation
    if (window._nurseAnimate) window._nurseAnimate(state);
  }

  function initThreeScene() {
    const container = document.getElementById("nurse-canvas-container");
    if (!container) { console.error('[3d] No container found'); return; }
    
    // Wait for container to have actual dimensions
    const w = container.clientWidth || 300;
    const h = container.clientHeight || 400;
    console.log('[3d] Container size:', w, 'x', h);

    if (typeof THREE === 'undefined') {
      console.error('[3d] Three.js not loaded — CDN may be unreachable');
      container.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#94a3b8;font-size:.85rem;text-align:center;padding:1rem;">3D viewer unavailable<br><small>Three.js CDN unreachable</small></div>';
      return;
    }

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x050e18);

    const camera = new THREE.PerspectiveCamera(40, w / h, 0.1, 100);
    camera.position.set(0, 0.8, 3.0);
    camera.lookAt(0, 0.6, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    container.appendChild(renderer.domElement);

    /* --- Lights (cool tones for holographic look) --- */
    scene.add(new THREE.AmbientLight(0x1a2a3a, 0.4));
    const key = new THREE.DirectionalLight(0x88ccff, 0.8);
    key.position.set(2, 3, 4);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0x0ea5e9, 0.4);
    fill.position.set(-3, 2, 2);
    scene.add(fill);
    const rim = new THREE.DirectionalLight(0x22d3ee, 0.3);
    rim.position.set(0, 2, -3);
    scene.add(rim);
    // Point light inside the hologram for glow
    const coreLight = new THREE.PointLight(0x38bdf8, 0.8, 3);
    coreLight.position.set(0, 0.8, 0);
    scene.add(coreLight);

    // Subtle floor grid for depth
    const gridHelper = new THREE.GridHelper(6, 20, 0x0a2030, 0x071520);
    gridHelper.position.y = -0.1;
    scene.add(gridHelper);

    // Build medical AI hologram
    buildProceduralNurse(scene);
    console.log('[3d] Medical AI hologram built');

    /* --- Animation loop --- */
    const clock = new THREE.Clock();

    function animate() {
      requestAnimationFrame(animate);
      const dt = clock.getDelta();
      const t = clock.getElapsedTime();

      if (nurseGroup) {
        animateProceduralNurse(t);
      }

      renderer.render(scene, camera);
    }
    animate();

    /* --- Resize handling --- */
    const ro = new ResizeObserver(() => {
      const cw = container.clientWidth;
      const ch = container.clientHeight;
      if (cw > 0 && ch > 0) {
        camera.aspect = cw / ch;
        camera.updateProjectionMatrix();
        renderer.setSize(cw, ch);
      }
    });
    ro.observe(container);
  }

  /* --- Medical AI Hologram --- */
  function buildProceduralNurse(scene) {
    nurseGroup = new THREE.Group();
    scene.add(nurseGroup);

    // === Materials ===
    const glowMat = new THREE.MeshStandardMaterial({
      color: 0x0ea5e9, emissive: 0x0ea5e9, emissiveIntensity: 0.4,
      roughness: 0.2, metalness: 0.8, transparent: true, opacity: 0.92
    });
    const coreMat = new THREE.MeshStandardMaterial({
      color: 0xffffff, emissive: 0x38bdf8, emissiveIntensity: 0.6,
      roughness: 0.1, metalness: 0.9
    });
    const darkMat = new THREE.MeshStandardMaterial({
      color: 0x0c4a6e, roughness: 0.5, metalness: 0.6
    });
    const ringMat = new THREE.MeshStandardMaterial({
      color: 0x22d3ee, emissive: 0x22d3ee, emissiveIntensity: 0.3,
      roughness: 0.15, metalness: 0.7, transparent: true, opacity: 0.7
    });
    const crossMat = new THREE.MeshStandardMaterial({
      color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.5,
      roughness: 0.1, metalness: 0.3
    });
    const hologramMat = new THREE.MeshStandardMaterial({
      color: 0x0ea5e9, emissive: 0x0ea5e9, emissiveIntensity: 0.2,
      roughness: 0.3, metalness: 0.5, transparent: true, opacity: 0.15, side: THREE.DoubleSide
    });

    // === Central sphere (AI core) ===
    const coreGeo = new THREE.IcosahedronGeometry(0.35, 2);
    const core = new THREE.Mesh(coreGeo, coreMat);
    core.position.y = 0.8;
    nurseGroup.add(core);
    nurseGroup._core = core;

    // Inner pulsing sphere
    const innerGeo = new THREE.SphereGeometry(0.22, 24, 20);
    const innerMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8, emissive: 0x0ea5e9, emissiveIntensity: 0.8,
      roughness: 0.0, metalness: 1.0, transparent: true, opacity: 0.6
    });
    const inner = new THREE.Mesh(innerGeo, innerMat);
    inner.position.y = 0.8;
    nurseGroup.add(inner);
    nurseGroup._inner = inner;

    // === Medical cross on front of core ===
    const crossV = new THREE.BoxGeometry(0.06, 0.22, 0.02);
    const crossH = new THREE.BoxGeometry(0.22, 0.06, 0.02);
    const cv = new THREE.Mesh(crossV, crossMat);
    cv.position.set(0, 0.8, 0.34);
    nurseGroup.add(cv);
    const ch = new THREE.Mesh(crossH, crossMat);
    ch.position.set(0, 0.8, 0.34);
    nurseGroup.add(ch);

    // === Orbiting rings ===
    const ring1Geo = new THREE.TorusGeometry(0.55, 0.015, 8, 64);
    const ring1 = new THREE.Mesh(ring1Geo, ringMat);
    ring1.position.y = 0.8;
    ring1.rotation.x = Math.PI / 2.5;
    nurseGroup.add(ring1);
    nurseGroup._ring1 = ring1;

    const ring2Geo = new THREE.TorusGeometry(0.65, 0.012, 8, 64);
    const ring2 = new THREE.Mesh(ring2Geo, ringMat);
    ring2.position.y = 0.8;
    ring2.rotation.x = Math.PI / 1.8;
    ring2.rotation.y = Math.PI / 3;
    nurseGroup.add(ring2);
    nurseGroup._ring2 = ring2;

    const ring3Geo = new THREE.TorusGeometry(0.75, 0.008, 8, 64);
    const ring3 = new THREE.Mesh(ring3Geo, ringMat);
    ring3.position.y = 0.8;
    ring3.rotation.x = Math.PI / 3.5;
    ring3.rotation.z = Math.PI / 4;
    nurseGroup.add(ring3);
    nurseGroup._ring3 = ring3;

    // === Orbiting health icons (small spheres on ring paths) ===
    const iconGeo = new THREE.OctahedronGeometry(0.05, 0);
    const iconMat1 = new THREE.MeshStandardMaterial({ color: 0xf43f5e, emissive: 0xf43f5e, emissiveIntensity: 0.5 }); // red - heart
    const iconMat2 = new THREE.MeshStandardMaterial({ color: 0x22c55e, emissive: 0x22c55e, emissiveIntensity: 0.5 }); // green - vitals
    const iconMat3 = new THREE.MeshStandardMaterial({ color: 0xeab308, emissive: 0xeab308, emissiveIntensity: 0.5 }); // yellow - alert

    const icon1 = new THREE.Mesh(iconGeo, iconMat1);
    nurseGroup.add(icon1);
    nurseGroup._icon1 = icon1;
    const icon2 = new THREE.Mesh(iconGeo, iconMat2);
    nurseGroup.add(icon2);
    nurseGroup._icon2 = icon2;
    const icon3 = new THREE.Mesh(iconGeo, iconMat3);
    nurseGroup.add(icon3);
    nurseGroup._icon3 = icon3;

    // === Holographic shield/dome ===
    const domeGeo = new THREE.SphereGeometry(0.9, 32, 24, 0, Math.PI * 2, 0, Math.PI / 2);
    const dome = new THREE.Mesh(domeGeo, hologramMat);
    dome.position.y = 0.0;
    nurseGroup.add(dome);
    nurseGroup._dome = dome;

    // === Base platform ===
    const baseGeo = new THREE.CylinderGeometry(0.5, 0.6, 0.06, 32);
    const baseMat = new THREE.MeshStandardMaterial({
      color: 0x0c4a6e, emissive: 0x0ea5e9, emissiveIntensity: 0.15,
      roughness: 0.3, metalness: 0.8
    });
    const base = new THREE.Mesh(baseGeo, baseMat);
    base.position.y = -0.05;
    nurseGroup.add(base);

    // Base ring glow
    const baseRingGeo = new THREE.TorusGeometry(0.55, 0.02, 8, 48);
    const baseRingMat = new THREE.MeshStandardMaterial({
      color: 0x22d3ee, emissive: 0x22d3ee, emissiveIntensity: 0.6,
      transparent: true, opacity: 0.8
    });
    const baseRing = new THREE.Mesh(baseRingGeo, baseRingMat);
    baseRing.position.y = -0.01;
    baseRing.rotation.x = Math.PI / 2;
    nurseGroup.add(baseRing);
    nurseGroup._baseRing = baseRing;

    // === Floating data particles ===
    const particleCount = 40;
    const particleGeo = new THREE.BufferGeometry();
    const particlePositions = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = 0.3 + Math.random() * 0.6;
      particlePositions[i * 3] = Math.cos(angle) * radius;
      particlePositions[i * 3 + 1] = Math.random() * 1.6;
      particlePositions[i * 3 + 2] = Math.sin(angle) * radius;
    }
    particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
    const particleMat = new THREE.PointsMaterial({
      color: 0x38bdf8, size: 0.025, transparent: true, opacity: 0.6
    });
    const particles = new THREE.Points(particleGeo, particleMat);
    nurseGroup.add(particles);
    nurseGroup._particles = particles;
    nurseGroup._particlePositions = particlePositions;

    // Pulse line (EKG style) — a sequence of small spheres forming a ring
    const pulseDots = [];
    const pulseGroup = new THREE.Group();
    pulseGroup.position.y = 0.8;
    const pulseDotGeo = new THREE.SphereGeometry(0.012, 6, 4);
    const pulseDotMat = new THREE.MeshBasicMaterial({ color: 0x22d3ee });
    for (let i = 0; i < 60; i++) {
      const dot = new THREE.Mesh(pulseDotGeo, pulseDotMat.clone());
      const angle = (i / 60) * Math.PI * 2;
      dot.position.set(Math.cos(angle) * 0.45, 0, Math.sin(angle) * 0.45);
      pulseGroup.add(dot);
      pulseDots.push(dot);
    }
    nurseGroup.add(pulseGroup);
    nurseGroup._pulseDots = pulseDots;
    nurseGroup._pulseGroup = pulseGroup;
  }

  /* --- Medical AI Hologram animation --- */
  function animateProceduralNurse(t) {
    const g = nurseGroup;

    // Core rotation and pulse
    if (g._core) {
      g._core.rotation.y = t * 0.3;
      g._core.rotation.x = Math.sin(t * 0.5) * 0.1;
      const pulse = 1.0 + Math.sin(t * 2) * 0.05;
      g._core.scale.set(pulse, pulse, pulse);
    }

    // Inner sphere counter-rotate and breathe
    if (g._inner) {
      g._inner.rotation.y = -t * 0.5;
      const breathe = 1.0 + Math.sin(t * 1.5) * 0.15;
      g._inner.scale.set(breathe, breathe, breathe);
      g._inner.material.emissiveIntensity = 0.5 + Math.sin(t * 2) * 0.3;
    }

    // Ring rotations (each at different speed)
    if (g._ring1) g._ring1.rotation.z = t * 0.4;
    if (g._ring2) g._ring2.rotation.z = -t * 0.25;
    if (g._ring3) g._ring3.rotation.y = t * 0.35;

    // Orbiting icons
    if (g._icon1) {
      const a1 = t * 0.7;
      g._icon1.position.set(Math.cos(a1) * 0.55, 0.8 + Math.sin(a1 * 2) * 0.15, Math.sin(a1) * 0.55);
      g._icon1.rotation.y = t * 2;
    }
    if (g._icon2) {
      const a2 = t * 0.5 + 2.1;
      g._icon2.position.set(Math.cos(a2) * 0.65, 0.8 + Math.sin(a2 * 1.5) * 0.2, Math.sin(a2) * 0.65);
      g._icon2.rotation.y = -t * 1.5;
    }
    if (g._icon3) {
      const a3 = t * 0.6 + 4.2;
      g._icon3.position.set(Math.cos(a3) * 0.75, 0.8 + Math.sin(a3 * 1.8) * 0.1, Math.sin(a3) * 0.75);
      g._icon3.rotation.y = t * 1.8;
    }

    // Base ring pulse
    if (g._baseRing) {
      const bp = 1.0 + Math.sin(t * 1.5) * 0.03;
      g._baseRing.scale.set(bp, bp, 1);
      g._baseRing.material.emissiveIntensity = 0.4 + Math.sin(t * 2) * 0.2;
    }

    // Dome subtle pulse
    if (g._dome) {
      g._dome.material.opacity = 0.08 + Math.sin(t * 1.2) * 0.05;
      g._dome.rotation.y = t * 0.1;
    }

    // Floating particles drift upward
    if (g._particlePositions) {
      const pos = g._particlePositions;
      for (let i = 0; i < pos.length / 3; i++) {
        pos[i * 3 + 1] += 0.003;
        if (pos[i * 3 + 1] > 1.8) pos[i * 3 + 1] = 0.1;
      }
      g._particles.geometry.attributes.position.needsUpdate = true;
    }

    // Pulse ring (EKG-style wave traveling around)
    if (g._pulseDots) {
      g._pulseDots.forEach((dot, i) => {
        const phase = (i / 60) * Math.PI * 2 - t * 3;
        // EKG-style: flat with occasional spikes
        let wave = 0;
        const p = ((phase % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
        if (p < 0.3) wave = Math.sin(p / 0.3 * Math.PI) * 0.12;
        else if (p < 0.5) wave = -Math.sin((p - 0.3) / 0.2 * Math.PI) * 0.05;
        dot.position.y = wave;
        // Glow the active segment
        const brightness = wave !== 0 ? 1.0 : 0.3;
        dot.material.color.setHSL(0.52, 0.9, brightness * 0.5);
      });
      g._pulseGroup.rotation.y = t * 0.15;
    }

    // === State-reactive behavior ===
    if (window.nurseIsSpeaking) {
      // Energetic: faster rotations, brighter glow
      if (g._core) {
        g._core.rotation.y = t * 1.2;
        g._core.material.emissiveIntensity = 0.6 + Math.sin(t * 6) * 0.3;
      }
      if (g._inner) {
        g._inner.material.emissiveIntensity = 0.8 + Math.sin(t * 5) * 0.2;
      }
      if (g._ring1) g._ring1.rotation.z = t * 1.5;
      if (g._ring2) g._ring2.rotation.z = -t * 1.0;
      setNurseActivity('speaking', 'Speaking…');
    } else {
      if (g._core) g._core.material.emissiveIntensity = 0.4;
      setNurseActivity('idle', 'Ready');
    }
  }

  /* =====================================================
     6. Initialization
     ===================================================== */
  document.addEventListener("DOMContentLoaded", () => {
    connectWebSocket();
    initThreeScene();

    // Send on form submit / Enter
    document.getElementById("chat-input-bar").addEventListener("submit", (e) => {
      e.preventDefault();
      sendMessage(document.getElementById("chat-input").value);
    });

    // Mic button
    document.getElementById("btn-mic").addEventListener("click", toggleRecording);

    // Reset button
    document.getElementById("btn-reset").addEventListener("click", resetSession);
  });
})();
