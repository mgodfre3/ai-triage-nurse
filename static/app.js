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

  /* ---------- chat_token streaming ---------- */
  function handleChatToken(token) {
    if (!currentAssistantBubble) {
      currentAssistantBubble = addMessageBubble("assistant", "");
    }
    currentAssistantBubble.textContent += token;
    scrollChat();

    window.nurseIsSpeaking = true;
    clearTimeout(speakingTimeout);
    speakingTimeout = setTimeout(() => {
      window.nurseIsSpeaking = false;
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
     5. Three.js — Procedural Nurse Avatar
     ===================================================== */
  let nurseGroup, headGroup, leftArm, rightArm, bodyMesh;

  function initThreeScene() {
    const container = document.getElementById("nurse-canvas-container");
    const w = container.clientWidth || 300;
    const h = container.clientHeight || 500;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a1628);

    const camera = new THREE.PerspectiveCamera(40, w / h, 0.1, 100);
    camera.position.set(0, 1.2, 5);
    camera.lookAt(0, 1, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    /* --- Lights --- */
    scene.add(new THREE.AmbientLight(0x8899bb, 0.7));
    const dir = new THREE.DirectionalLight(0xffffff, 0.8);
    dir.position.set(3, 5, 4);
    scene.add(dir);
    const fill = new THREE.DirectionalLight(0x44ddcc, 0.3);
    fill.position.set(-3, 2, 2);
    scene.add(fill);

    /* --- Build nurse --- */
    nurseGroup = new THREE.Group();
    scene.add(nurseGroup);

    // Body (scrubs cylinder)
    const bodyGeo = new THREE.CylinderGeometry(0.38, 0.32, 1.2, 16);
    const scrubs = new THREE.MeshStandardMaterial({ color: 0x0d9488 });
    bodyMesh = new THREE.Mesh(bodyGeo, scrubs);
    bodyMesh.position.y = 0.6;
    nurseGroup.add(bodyMesh);

    // Name tag
    const tagGeo = new THREE.BoxGeometry(0.18, 0.1, 0.02);
    const tagMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
    const tag = new THREE.Mesh(tagGeo, tagMat);
    tag.position.set(0.12, 0.85, 0.36);
    nurseGroup.add(tag);

    // Stethoscope (torus around neck)
    const stethGeo = new THREE.TorusGeometry(0.2, 0.025, 8, 24);
    const stethMat = new THREE.MeshStandardMaterial({ color: 0xaaaaaa, metalness: 0.6, roughness: 0.3 });
    const steth = new THREE.Mesh(stethGeo, stethMat);
    steth.position.set(0, 1.12, 0.08);
    steth.rotation.x = Math.PI / 2.5;
    nurseGroup.add(steth);

    // Head group
    headGroup = new THREE.Group();
    headGroup.position.y = 1.55;
    nurseGroup.add(headGroup);

    // Head sphere
    const headGeo = new THREE.SphereGeometry(0.28, 20, 16);
    const skinMat = new THREE.MeshStandardMaterial({ color: 0xf5deb3 });
    const head = new THREE.Mesh(headGeo, skinMat);
    headGroup.add(head);

    // Hair
    const hairGeo = new THREE.SphereGeometry(0.3, 20, 16);
    const hairMat = new THREE.MeshStandardMaterial({ color: 0x3b2717 });
    const hair = new THREE.Mesh(hairGeo, hairMat);
    hair.position.set(0, 0.06, -0.06);
    hair.scale.set(1, 1, 0.9);
    headGroup.add(hair);

    // Nurse cap
    const capGeo = new THREE.BoxGeometry(0.22, 0.1, 0.04);
    const capMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
    const cap = new THREE.Mesh(capGeo, capMat);
    cap.position.set(0, 0.3, 0.05);
    headGroup.add(cap);

    // Red cross on cap
    const crossH = new THREE.Mesh(
      new THREE.BoxGeometry(0.1, 0.03, 0.02),
      new THREE.MeshStandardMaterial({ color: 0xef4444 })
    );
    crossH.position.set(0, 0.3, 0.075);
    headGroup.add(crossH);
    const crossV = new THREE.Mesh(
      new THREE.BoxGeometry(0.03, 0.1, 0.02),
      new THREE.MeshStandardMaterial({ color: 0xef4444 })
    );
    crossV.position.set(0, 0.3, 0.075);
    headGroup.add(crossV);

    // Eyes
    const eyeGeo = new THREE.SphereGeometry(0.035, 10, 8);
    const eyeMat = new THREE.MeshStandardMaterial({ color: 0x1e293b });
    const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
    leftEye.position.set(-0.1, 0.04, 0.24);
    headGroup.add(leftEye);
    const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
    rightEye.position.set(0.1, 0.04, 0.24);
    headGroup.add(rightEye);

    // Smile (torus arc)
    const smileGeo = new THREE.TorusGeometry(0.08, 0.015, 8, 16, Math.PI);
    const smileMat = new THREE.MeshStandardMaterial({ color: 0xc0392b });
    const smile = new THREE.Mesh(smileGeo, smileMat);
    smile.position.set(0, -0.06, 0.24);
    smile.rotation.x = Math.PI;
    headGroup.add(smile);

    // Arms
    const armGeo = new THREE.CylinderGeometry(0.07, 0.06, 0.7, 10);
    const armMat = new THREE.MeshStandardMaterial({ color: 0x0d9488 });

    leftArm = new THREE.Mesh(armGeo, armMat);
    leftArm.position.set(-0.48, 0.8, 0);
    leftArm.rotation.z = 0.18;
    nurseGroup.add(leftArm);

    rightArm = new THREE.Mesh(armGeo, armMat);
    rightArm.position.set(0.48, 0.8, 0);
    rightArm.rotation.z = -0.18;
    nurseGroup.add(rightArm);

    // Legs (simple cylinders)
    const legGeo = new THREE.CylinderGeometry(0.1, 0.09, 0.8, 10);
    const legMat = new THREE.MeshStandardMaterial({ color: 0x1e293b });
    const leftLeg = new THREE.Mesh(legGeo, legMat);
    leftLeg.position.set(-0.14, -0.4, 0);
    nurseGroup.add(leftLeg);
    const rightLeg = new THREE.Mesh(legGeo, legMat);
    rightLeg.position.set(0.14, -0.4, 0);
    nurseGroup.add(rightLeg);

    /* --- Animation loop --- */
    const clock = new THREE.Clock();

    function animate() {
      requestAnimationFrame(animate);
      const t = clock.getElapsedTime();

      // Idle breathing
      const breathe = 1 + Math.sin(t * 2) * 0.015;
      bodyMesh.scale.set(breathe, 1, breathe);

      // Idle head bob
      headGroup.rotation.z = Math.sin(t * 1.5) * 0.02;
      headGroup.position.y = 1.55 + Math.sin(t * 1.8) * 0.01;

      // Speaking animation
      if (window.nurseIsSpeaking) {
        headGroup.rotation.x = Math.sin(t * 4) * 0.08;
        rightArm.rotation.z = -0.18 + Math.sin(t * 3) * 0.25;
        leftArm.rotation.z = 0.18 + Math.sin(t * 3 + 1) * 0.1;
      } else {
        headGroup.rotation.x *= 0.9; // ease back
        rightArm.rotation.z += (-0.18 - rightArm.rotation.z) * 0.08;
        leftArm.rotation.z += (0.18 - leftArm.rotation.z) * 0.08;
      }

      renderer.render(scene, camera);
    }
    animate();

    /* --- Resize handling --- */
    const ro = new ResizeObserver(() => {
      const cw = container.clientWidth;
      const ch = container.clientHeight;
      camera.aspect = cw / ch;
      camera.updateProjectionMatrix();
      renderer.setSize(cw, ch);
    });
    ro.observe(container);
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
