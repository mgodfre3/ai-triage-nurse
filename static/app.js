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
  let mixer = null;   // AnimationMixer for GLTF models
  let nurseGroup, headGroup, leftArm, rightArm, bodyMesh; // procedural fallback

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
    scene.background = new THREE.Color(0x0a1628);

    const camera = new THREE.PerspectiveCamera(40, w / h, 0.1, 100);
    camera.position.set(0, 1.2, 4);
    camera.lookAt(0, 1, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    container.appendChild(renderer.domElement);

    /* --- Lights (improved for character rendering) --- */
    scene.add(new THREE.AmbientLight(0xc4d4e8, 0.6));
    const key = new THREE.DirectionalLight(0xfff8f0, 1.0);
    key.position.set(2, 4, 3);
    key.castShadow = true;
    scene.add(key);
    const fill = new THREE.DirectionalLight(0x88ccdd, 0.4);
    fill.position.set(-3, 2, 1);
    scene.add(fill);
    const rim = new THREE.DirectionalLight(0x4488aa, 0.3);
    rim.position.set(0, 3, -3);
    scene.add(rim);

    // Subtle floor grid for depth
    const gridHelper = new THREE.GridHelper(6, 20, 0x1a3040, 0x0f2030);
    gridHelper.position.y = -0.8;
    scene.add(gridHelper);

    /* --- Try loading GLTF model, fall back to procedural --- */
    let modelLoaded = false;
    let gltfActions = {};   // { idle, speak, think, agree }
    let activeAction = null;

    function crossFadeTo(newName) {
      const next = gltfActions[newName] || gltfActions.idle;
      if (!next || next === activeAction) return;
      if (activeAction) {
        activeAction.fadeOut(0.35);
      }
      next.reset().fadeIn(0.35).play();
      activeAction = next;
    }

    // Expose animation state changes
    window._nurseAnimate = function (state) {
      if (!modelLoaded) return;
      if (state === 'speaking') crossFadeTo('speak');
      else if (state === 'thinking') crossFadeTo('think');
      else crossFadeTo('idle');
    };

    // Always build procedural nurse first as immediate visual
    buildProceduralNurse(scene);
    console.log('[3d] Procedural nurse built as default');

    if (typeof THREE.GLTFLoader !== 'undefined') {
      console.log('[3d] GLTFLoader available, loading nurse.glb...');
      const loader = new THREE.GLTFLoader();
      loader.load(
        '/static/nurse.glb',
        (gltf) => {
          try {
            // Remove procedural nurse
            if (nurseGroup) { scene.remove(nurseGroup); nurseGroup = null; }

            const model = gltf.scene;

            model.traverse((child) => {
              if (child.isMesh && child.material) {
                const mats = Array.isArray(child.material) ? child.material : [child.material];
                mats.forEach((mat) => {
                  if (mat.emissive) mat.emissive.set(0x0a1a2a);
                  mat.needsUpdate = true;
                });
              }
            });

            const box = new THREE.Box3().setFromObject(model);
            const center = box.getCenter(new THREE.Vector3());
            const height = box.max.y - box.min.y;
            model.position.set(-center.x, -box.min.y - 0.8, -center.z);
            camera.position.set(0, height * 0.45, height * 1.6);
            camera.lookAt(0, height * 0.4, 0);
            scene.add(model);
            modelLoaded = true;

            if (gltf.animations && gltf.animations.length) {
              mixer = new THREE.AnimationMixer(model);
              const clips = {};
              gltf.animations.forEach(a => { clips[a.name.toLowerCase()] = a; });
              console.log('[3d] Available animations:', Object.keys(clips).join(', '));

              gltfActions.idle = mixer.clipAction(
                clips.idle || clips.breathing || clips.stand || gltf.animations[0]
              );
              gltfActions.speak = mixer.clipAction(
                clips.talking || clips.talk || clips.agree || clips.walk || gltf.animations[Math.min(1, gltf.animations.length - 1)]
              );
              gltfActions.think = mixer.clipAction(
                clips.thinking || clips.sad_pose || clips.headshake || gltf.animations[0]
              );

              gltfActions.idle.play();
              activeAction = gltfActions.idle;
            } else {
              console.log('[3d] No embedded animations — using procedural sway');
            }

            // Store model ref for procedural animation on static models
            window._gltfModel = model;
            window._gltfBaseY = model.position.y;

            console.log('[3d] GLTF nurse model loaded (' + height.toFixed(1) + ' units tall)');
          } catch (err) {
            console.error('[3d] Error setting up GLTF model:', err);
            // Procedural already removed — rebuild it
            buildProceduralNurse(scene);
          }
        },
        (xhr) => {
          if (xhr.total) console.log('[3d] Loading: ' + Math.round(xhr.loaded / xhr.total * 100) + '%');
        },
        (err) => {
          console.warn('[3d] GLTF load failed:', err, '— keeping procedural nurse');
        }
      );
    } else {
      console.warn('[3d] GLTFLoader not available (CDN may be blocked)');
    }

    /* --- Animation loop --- */
    const clock = new THREE.Clock();
    let _nurseState = 'idle'; // track current nurse activity state

    // Override _nurseAnimate to also track state for procedural motion
    const origAnimate = window._nurseAnimate;
    window._nurseAnimate = function (state) {
      _nurseState = state;
      if (origAnimate) origAnimate(state);
    };

    function animate() {
      requestAnimationFrame(animate);
      const dt = clock.getDelta();
      const t = clock.getElapsedTime();

      // Update GLTF animations (if clips exist)
      if (mixer) mixer.update(dt);

      // Procedural sway for static GLTF model (no animation clips)
      if (modelLoaded && !mixer && window._gltfModel) {
        const m = window._gltfModel;
        const baseY = window._gltfBaseY || 0;
        // Gentle breathing (Y bob)
        m.position.y = baseY + Math.sin(t * 1.5) * 0.15;
        // Subtle body sway
        m.rotation.y = Math.sin(t * 0.8) * 0.04;

        if (_nurseState === 'speaking') {
          // More lively — slight lean and faster sway
          m.rotation.z = Math.sin(t * 3) * 0.02;
          m.rotation.y = Math.sin(t * 1.5) * 0.08;
        } else if (_nurseState === 'thinking') {
          // Slight head tilt
          m.rotation.z = 0.03;
          m.rotation.x = Math.sin(t * 0.5) * 0.02;
        } else {
          m.rotation.z = 0;
          m.rotation.x = 0;
        }
      }

      // Procedural animations (only if no GLTF model loaded)
      if (!modelLoaded && nurseGroup) {
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

  /* --- Improved procedural nurse (fallback) --- */
  function buildProceduralNurse(scene) {
    nurseGroup = new THREE.Group();
    scene.add(nurseGroup);

    const skinMat = new THREE.MeshStandardMaterial({
      color: 0xdeb896, roughness: 0.7, metalness: 0.0
    });
    const scrubsMat = new THREE.MeshStandardMaterial({
      color: 0x0d9488, roughness: 0.6, metalness: 0.05
    });
    const darkMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b, roughness: 0.8
    });
    const hairMat = new THREE.MeshStandardMaterial({
      color: 0x2c1810, roughness: 0.9
    });
    const whiteMat = new THREE.MeshStandardMaterial({
      color: 0xffffff, roughness: 0.4
    });

    // ── Body (more shaped torso) ──
    const bodyGeo = new THREE.CylinderGeometry(0.30, 0.24, 1.1, 24);
    bodyMesh = new THREE.Mesh(bodyGeo, scrubsMat);
    bodyMesh.position.y = 0.55;
    nurseGroup.add(bodyMesh);

    // Collar detail
    const collarGeo = new THREE.TorusGeometry(0.28, 0.03, 8, 24, Math.PI);
    const collar = new THREE.Mesh(collarGeo, new THREE.MeshStandardMaterial({ color: 0x0b7d72 }));
    collar.position.set(0, 1.05, 0.05);
    collar.rotation.x = -0.3;
    nurseGroup.add(collar);

    // V-neck detail
    const vneckShape = new THREE.Shape();
    vneckShape.moveTo(-0.08, 0);
    vneckShape.lineTo(0, -0.12);
    vneckShape.lineTo(0.08, 0);
    const vneckGeo = new THREE.ShapeGeometry(vneckShape);
    const vneck = new THREE.Mesh(vneckGeo, skinMat);
    vneck.position.set(0, 1.0, 0.305);
    nurseGroup.add(vneck);

    // ── Name badge ──
    const badgeGeo = new THREE.BoxGeometry(0.16, 0.09, 0.015);
    const badgeMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 });
    const badge = new THREE.Mesh(badgeGeo, badgeMat);
    badge.position.set(0.14, 0.88, 0.30);
    nurseGroup.add(badge);
    // Badge accent stripe
    const stripeGeo = new THREE.BoxGeometry(0.16, 0.02, 0.016);
    const stripe = new THREE.Mesh(stripeGeo, new THREE.MeshStandardMaterial({ color: 0x0d9488 }));
    stripe.position.set(0.14, 0.91, 0.301);
    nurseGroup.add(stripe);

    // ── Stethoscope ──
    const stethTube = new THREE.TorusGeometry(0.22, 0.018, 8, 32);
    const stethMat = new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.7, roughness: 0.2 });
    const steth = new THREE.Mesh(stethTube, stethMat);
    steth.position.set(0, 1.08, 0.06);
    steth.rotation.x = Math.PI / 2.3;
    nurseGroup.add(steth);
    // Earpieces
    const earGeo = new THREE.SphereGeometry(0.025, 8, 8);
    const earL = new THREE.Mesh(earGeo, stethMat);
    earL.position.set(-0.16, 1.2, -0.08);
    nurseGroup.add(earL);
    const earR = new THREE.Mesh(earGeo, stethMat);
    earR.position.set(0.16, 1.2, -0.08);
    nurseGroup.add(earR);
    // Chest piece
    const chestGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.015, 16);
    const chest = new THREE.Mesh(chestGeo, stethMat);
    chest.position.set(0.08, 0.6, 0.27);
    chest.rotation.x = Math.PI / 2;
    nurseGroup.add(chest);

    // ── Head ──
    headGroup = new THREE.Group();
    headGroup.position.y = 1.50;
    nurseGroup.add(headGroup);

    // Head (slightly oval)
    const headGeo = new THREE.SphereGeometry(0.25, 24, 20);
    const head = new THREE.Mesh(headGeo, skinMat);
    head.scale.set(0.92, 1.0, 0.88);
    headGroup.add(head);

    // Neck
    const neckGeo = new THREE.CylinderGeometry(0.09, 0.11, 0.15, 12);
    const neck = new THREE.Mesh(neckGeo, skinMat);
    neck.position.y = -0.30;
    headGroup.add(neck);

    // ── Hair (layered for volume) ──
    const hairBack = new THREE.Mesh(
      new THREE.SphereGeometry(0.27, 20, 16),
      hairMat
    );
    hairBack.position.set(0, 0.04, -0.04);
    hairBack.scale.set(1.02, 1.04, 0.95);
    headGroup.add(hairBack);
    // Side hair
    const sideHairGeo = new THREE.SphereGeometry(0.12, 12, 10);
    const sideL = new THREE.Mesh(sideHairGeo, hairMat);
    sideL.position.set(-0.22, -0.04, 0.02);
    sideL.scale.set(0.7, 1.2, 0.8);
    headGroup.add(sideL);
    const sideR = new THREE.Mesh(sideHairGeo, hairMat);
    sideR.position.set(0.22, -0.04, 0.02);
    sideR.scale.set(0.7, 1.2, 0.8);
    headGroup.add(sideR);
    // Hair bun
    const bunGeo = new THREE.SphereGeometry(0.10, 12, 10);
    const bun = new THREE.Mesh(bunGeo, hairMat);
    bun.position.set(0, 0.18, -0.22);
    headGroup.add(bun);

    // ── Face features ──
    // Eyebrows
    const browGeo = new THREE.BoxGeometry(0.08, 0.015, 0.015);
    const browMat = new THREE.MeshStandardMaterial({ color: 0x3b2717 });
    const browL = new THREE.Mesh(browGeo, browMat);
    browL.position.set(-0.08, 0.10, 0.22);
    browL.rotation.z = 0.08;
    headGroup.add(browL);
    const browR = new THREE.Mesh(browGeo, browMat);
    browR.position.set(0.08, 0.10, 0.22);
    browR.rotation.z = -0.08;
    headGroup.add(browR);

    // Eyes (with iris and highlight)
    const eyeWhiteGeo = new THREE.SphereGeometry(0.038, 12, 10);
    const eyeWhiteMat = new THREE.MeshStandardMaterial({ color: 0xf8f8f8, roughness: 0.2 });
    const eyeWL = new THREE.Mesh(eyeWhiteGeo, eyeWhiteMat);
    eyeWL.position.set(-0.085, 0.045, 0.21);
    eyeWL.scale.set(1, 0.85, 0.5);
    headGroup.add(eyeWL);
    const eyeWR = new THREE.Mesh(eyeWhiteGeo, eyeWhiteMat);
    eyeWR.position.set(0.085, 0.045, 0.21);
    eyeWR.scale.set(1, 0.85, 0.5);
    headGroup.add(eyeWR);
    // Irises
    const irisGeo = new THREE.SphereGeometry(0.022, 10, 8);
    const irisMat = new THREE.MeshStandardMaterial({ color: 0x3b7dd8, roughness: 0.3 });
    const irisL = new THREE.Mesh(irisGeo, irisMat);
    irisL.position.set(-0.085, 0.045, 0.235);
    headGroup.add(irisL);
    const irisR = new THREE.Mesh(irisGeo, irisMat);
    irisR.position.set(0.085, 0.045, 0.235);
    headGroup.add(irisR);
    // Pupils
    const pupilGeo = new THREE.SphereGeometry(0.012, 8, 6);
    const pupilMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
    const pupilL = new THREE.Mesh(pupilGeo, pupilMat);
    pupilL.position.set(-0.085, 0.045, 0.245);
    headGroup.add(pupilL);
    const pupilR = new THREE.Mesh(pupilGeo, pupilMat);
    pupilR.position.set(0.085, 0.045, 0.245);
    headGroup.add(pupilR);
    // Eye highlights
    const hlGeo = new THREE.SphereGeometry(0.006, 6, 4);
    const hlMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const hlL = new THREE.Mesh(hlGeo, hlMat);
    hlL.position.set(-0.076, 0.054, 0.25);
    headGroup.add(hlL);
    const hlR = new THREE.Mesh(hlGeo, hlMat);
    hlR.position.set(0.076, 0.054, 0.25);
    headGroup.add(hlR);

    // Eyelids (for blink animation)
    const lidGeo = new THREE.SphereGeometry(0.04, 12, 6, 0, Math.PI * 2, 0, Math.PI * 0.5);
    const lidMat = new THREE.MeshStandardMaterial({ color: 0xdeb896, roughness: 0.7 });
    nurseGroup._lidL = new THREE.Mesh(lidGeo, lidMat);
    nurseGroup._lidL.position.set(-0.085, 0.055, 0.215);
    nurseGroup._lidL.scale.set(1, 0.1, 0.5);
    nurseGroup._lidL.rotation.x = -0.3;
    headGroup.add(nurseGroup._lidL);
    nurseGroup._lidR = new THREE.Mesh(lidGeo, lidMat);
    nurseGroup._lidR.position.set(0.085, 0.055, 0.215);
    nurseGroup._lidR.scale.set(1, 0.1, 0.5);
    nurseGroup._lidR.rotation.x = -0.3;
    headGroup.add(nurseGroup._lidR);

    // Nose
    const noseGeo = new THREE.ConeGeometry(0.025, 0.05, 8);
    const nose = new THREE.Mesh(noseGeo, skinMat);
    nose.position.set(0, -0.01, 0.245);
    nose.rotation.x = -0.35;
    headGroup.add(nose);

    // Lips / Mouth
    const lipsGeo = new THREE.TorusGeometry(0.04, 0.012, 8, 16, Math.PI);
    const lipsMat = new THREE.MeshStandardMaterial({ color: 0xc07070, roughness: 0.5 });
    nurseGroup._mouth = new THREE.Mesh(lipsGeo, lipsMat);
    nurseGroup._mouth.position.set(0, -0.07, 0.22);
    nurseGroup._mouth.rotation.x = Math.PI + 0.2;
    headGroup.add(nurseGroup._mouth);

    // ── Arms (with hands) ──
    const armGeo = new THREE.CylinderGeometry(0.06, 0.05, 0.55, 14);
    leftArm = new THREE.Group();
    const lArmMesh = new THREE.Mesh(armGeo, scrubsMat);
    leftArm.add(lArmMesh);
    // Forearm (skin)
    const foreGeo = new THREE.CylinderGeometry(0.04, 0.035, 0.25, 10);
    const foreL = new THREE.Mesh(foreGeo, skinMat);
    foreL.position.y = -0.40;
    leftArm.add(foreL);
    // Hand
    const handGeo = new THREE.SphereGeometry(0.04, 8, 6);
    const handL = new THREE.Mesh(handGeo, skinMat);
    handL.position.y = -0.55;
    leftArm.add(handL);
    leftArm.position.set(-0.38, 0.82, 0);
    leftArm.rotation.z = 0.15;
    nurseGroup.add(leftArm);

    rightArm = new THREE.Group();
    const rArmMesh = new THREE.Mesh(armGeo, scrubsMat);
    rightArm.add(rArmMesh);
    const foreR = new THREE.Mesh(foreGeo, skinMat);
    foreR.position.y = -0.40;
    rightArm.add(foreR);
    const handR = new THREE.Mesh(handGeo, skinMat);
    handR.position.y = -0.55;
    rightArm.add(handR);
    rightArm.position.set(0.38, 0.82, 0);
    rightArm.rotation.z = -0.15;
    nurseGroup.add(rightArm);

    // Clipboard in left hand
    const clipGeo = new THREE.BoxGeometry(0.16, 0.22, 0.015);
    const clipMat = new THREE.MeshStandardMaterial({ color: 0x8b6914, roughness: 0.6 });
    const clipboard = new THREE.Mesh(clipGeo, clipMat);
    clipboard.position.set(-0.42, 0.25, 0.12);
    clipboard.rotation.set(0.1, 0.3, 0.15);
    nurseGroup.add(clipboard);
    // Paper on clipboard
    const paperGeo = new THREE.BoxGeometry(0.13, 0.18, 0.005);
    const paper = new THREE.Mesh(paperGeo, whiteMat);
    paper.position.set(-0.42, 0.26, 0.13);
    paper.rotation.set(0.1, 0.3, 0.15);
    nurseGroup.add(paper);

    // ── Legs ──
    const legGeo = new THREE.CylinderGeometry(0.09, 0.08, 0.7, 12);
    const leftLeg = new THREE.Mesh(legGeo, darkMat);
    leftLeg.position.set(-0.12, -0.35, 0);
    nurseGroup.add(leftLeg);
    const rightLeg = new THREE.Mesh(legGeo, darkMat);
    rightLeg.position.set(0.12, -0.35, 0);
    nurseGroup.add(rightLeg);

    // Shoes
    const shoeGeo = new THREE.BoxGeometry(0.1, 0.05, 0.14);
    const shoeMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 });
    const shoeL = new THREE.Mesh(shoeGeo, shoeMat);
    shoeL.position.set(-0.12, -0.73, 0.02);
    nurseGroup.add(shoeL);
    const shoeR = new THREE.Mesh(shoeGeo, shoeMat);
    shoeR.position.set(0.12, -0.73, 0.02);
    nurseGroup.add(shoeR);

    // Track blink timer
    nurseGroup._lastBlink = 0;
    nurseGroup._blinking = false;
  }

  /* --- Procedural nurse animation --- */
  function animateProceduralNurse(t) {
    // Idle breathing
    const breathe = 1 + Math.sin(t * 1.8) * 0.012;
    bodyMesh.scale.set(breathe, 1, breathe);

    // Subtle weight shift
    nurseGroup.position.x = Math.sin(t * 0.5) * 0.01;
    nurseGroup.rotation.y = Math.sin(t * 0.3) * 0.02;

    // Head movement
    headGroup.rotation.z = Math.sin(t * 1.2) * 0.015;
    headGroup.position.y = 1.50 + Math.sin(t * 1.5) * 0.008;

    // Eye blink (every 3-5 seconds)
    if (nurseGroup._lidL) {
      if (!nurseGroup._blinking && t - nurseGroup._lastBlink > 3 + Math.random() * 2) {
        nurseGroup._blinking = true;
        nurseGroup._lastBlink = t;
      }
      if (nurseGroup._blinking) {
        const blinkPhase = (t - nurseGroup._lastBlink) * 8;
        const blinkVal = blinkPhase < 1 ? blinkPhase : (blinkPhase < 2 ? 2 - blinkPhase : 0);
        nurseGroup._lidL.scale.y = 0.1 + blinkVal * 0.9;
        nurseGroup._lidR.scale.y = 0.1 + blinkVal * 0.9;
        if (blinkPhase > 2) {
          nurseGroup._blinking = false;
          nurseGroup._lidL.scale.y = 0.1;
          nurseGroup._lidR.scale.y = 0.1;
        }
      }
    }

    // Speaking animation
    if (window.nurseIsSpeaking) {
      headGroup.rotation.x = Math.sin(t * 3.5) * 0.06;
      rightArm.rotation.z = -0.15 + Math.sin(t * 2.5) * 0.2;
      rightArm.rotation.x = Math.sin(t * 2) * 0.1;
      leftArm.rotation.z = 0.15 + Math.sin(t * 2.5 + 1) * 0.08;
      // Mouth movement
      if (nurseGroup._mouth) {
        nurseGroup._mouth.scale.y = 1 + Math.sin(t * 8) * 0.4;
        nurseGroup._mouth.scale.x = 1 + Math.sin(t * 6) * 0.15;
      }
      setNurseActivity('speaking', 'Speaking…');
    } else {
      headGroup.rotation.x *= 0.92;
      rightArm.rotation.z += (-0.15 - rightArm.rotation.z) * 0.06;
      rightArm.rotation.x *= 0.92;
      leftArm.rotation.z += (0.15 - leftArm.rotation.z) * 0.06;
      if (nurseGroup._mouth) {
        nurseGroup._mouth.scale.y += (1 - nurseGroup._mouth.scale.y) * 0.1;
        nurseGroup._mouth.scale.x += (1 - nurseGroup._mouth.scale.x) * 0.1;
      }
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
