# 🏥 AI Triage Nurse — Demo Day Guide

> **Purpose:** Walk through four patient scenarios that showcase the full range of triage priorities.
> Each scenario is scripted so any presenter can drive the demo confidently.

---

## 📋 Pre-Demo Checklist

Before you start, confirm every item:

- [ ] **Models cached** — Open the app once and run a test prompt. Confirm the model loads without downloading.
- [ ] **WiFi ready to toggle** — Know where your airplane-mode toggle is. You'll flip it mid-demo.
- [ ] **Browser open** — App loaded at the correct URL, no stale cache.
- [ ] **Mic tested** — Say a test phrase and verify the transcript appears. Check browser mic permissions.
- [ ] **Volume up** — If the 3D nurse has voice output, confirm speakers/headphones work.
- [ ] **Screen sharing active** — Audience can see the browser and the form side-by-side.
- [ ] **Backup device ready** — If primary laptop fails, have a second machine with the app loaded.
- [ ] **Notes visible** — Keep this doc open on a second screen or printed out.

---

## ⭐ Showstopper Moments

Hit **at least three** of these during the demo, regardless of which scenario you're running:

| # | Moment | When to Do It | What to Say |
|---|--------|---------------|-------------|
| 1 | **"Watch the form fill itself"** | During any scenario, after the AI asks its first question | *"Notice the patient intake form on the right — it's updating in real-time as the conversation happens. No one is typing into that form."* |
| 2 | **"No internet required"** | Between Scenario 1 and 2 (or whenever natural) | *"Let me toggle airplane mode right now..."* [flip it] *"...and we're still running. The model, the UI, everything — it's all local."* |
| 3 | **"Voice input"** | During Scenario 3 (Jake is casual — voice feels natural) | *"Instead of typing, I'll just speak Jake's symptoms."* [click mic, speak aloud] |
| 4 | **"Privacy"** | During Scenario 1 (highest-stakes patient data) | *"Marcus just described cardiac symptoms. That data never left this device. No cloud. No third-party API. Full HIPAA-friendly architecture."* |
| 5 | **"The 3D nurse reacts"** | Whenever the AI is responding | *"Watch the nurse avatar — she's not just static. She animates when she speaks, giving the patient a sense of a real conversation."* |

---

## 🔴 Scenario 1: Emergency — Chest Pain

### Patient Persona

| Field | Detail |
|-------|--------|
| **Name** | Marcus Thompson |
| **Age** | 58 |
| **Personality** | Anxious, slightly dismissive. Tries to downplay symptoms because he's scared. Uses short sentences. Doesn't volunteer information unless asked. |

### Script

**Opening line (type or speak this first):**
> "I've been having some chest discomfort. It's probably nothing, but my wife made me come in."

**When the AI asks about the chest pain:**
> "It's like a pressure... a tightness right in the center of my chest. Started about an hour ago."

**When the AI asks about other symptoms:**
> "Well, now that you mention it, I am a little short of breath. I figured I was just out of shape."

**When the AI asks about arm/jaw/back pain:**
> "Actually, yeah — my left arm has been tingling. I thought I slept on it wrong."

**When the AI asks about medical history:**
> "I have high blood pressure. My dad had a heart attack at 62. I take lisinopril."

**When the AI asks about severity (scale of 1–10):**
> "Maybe a 6? It comes and goes. Okay, maybe a 7."

### Expected Triage Outcome

| Priority | Color | Reasoning |
|----------|-------|-----------|
| **Emergency** | 🔴 RED | Classic cardiac presentation: central chest pressure + dyspnea + left arm paresthesia + family history of MI + age/gender risk factors. Requires immediate evaluation. |

### Demo Talking Points

- **Lead with:** *"Watch how fast the AI escalates to emergency priority."*
- Point out that Marcus tried to minimize his symptoms — the AI still caught the red flags.
- Highlight the combination of symptoms triggering the escalation, not any single symptom alone.
- Note the form auto-populating: chief complaint, associated symptoms, medical history, medications.
- **Privacy moment:** *"This man just described a potential heart attack. That data stayed right here on this laptop."*

---

## 🟠 Scenario 2: Urgent — Persistent Headache

### Patient Persona

| Field | Detail |
|-------|--------|
| **Name** | Sarah Chen |
| **Age** | 34 |
| **Personality** | Worried, articulate. She's been Googling her symptoms and is scared it's something serious. Gives detailed answers. |

### Script

**Opening line:**
> "I've been having really bad headaches for the past two weeks and they're getting worse. I'm starting to get scared."

**When the AI asks about headache characteristics:**
> "They're worst in the morning when I first wake up. A deep, throbbing pain, mostly behind my eyes. By afternoon they ease up a little."

**When the AI asks about severity:**
> "When they're bad, like an 8 out of 10. I've never had headaches like this before in my life."

**When the AI asks about other symptoms:**
> "Yes — my vision has been a little blurry sometimes. And once or twice I felt a bit nauseous in the morning."

**When the AI asks about medications or what they've tried:**
> "I've been taking ibuprofen but it barely touches it. I went through a whole bottle last week."

**When the AI asks about medical/family history:**
> "No major medical history. No family history of migraines that I know of. I don't take any regular medications."

**When the AI asks about recent changes (stress, diet, injury):**
> "No head injuries. Work has been stressful but not more than usual. I haven't changed anything."

### Expected Triage Outcome

| Priority | Color | Reasoning |
|----------|-------|-----------|
| **Urgent** | 🟠 ORANGE | New-onset headaches with progressive worsening + morning predominance + visual changes + nausea = neurological red flags. Pattern is concerning for raised intracranial pressure. Not immediately life-threatening, but requires urgent imaging and neurological workup. |

### Demo Talking Points

- **Lead with:** *"Notice the AI asking targeted follow-up questions about neurological symptoms."*
- Highlight that the AI didn't stop at "headache" — it probed for timing pattern, visual changes, and nausea.
- Point out the morning-worsening pattern is a specific red flag the AI recognized.
- Show that the triage is ORANGE, not RED — the AI differentiates between "urgent" and "emergency."
- *"This is where the AI's medical knowledge really shows. A simple chatbot would say 'take Tylenol.' This one flags it for urgent neuro evaluation."*

---

## 🟡 Scenario 3: Less Urgent — Sports Injury

### Patient Persona

| Field | Detail |
|-------|--------|
| **Name** | Jake Rivera |
| **Age** | 22 |
| **Personality** | Casual, upbeat, a little impatient. Uses slang. Thinks he's fine and just wants to get cleared to play again. |

### Script

**Opening line:**
> "Hey, so I rolled my ankle pretty bad playing basketball yesterday. It's kinda swollen but I can still walk on it."

**When the AI asks about what happened:**
> "I came down on someone's foot after a rebound. My ankle went sideways — inward I think. Heard a little pop but I kept playing for a few more minutes."

**When the AI asks about current symptoms:**
> "It's swollen on the outside, kinda bruised looking. Hurts when I turn my foot inward. I can walk but I'm limping."

**When the AI asks about severity (scale of 1–10):**
> "Like a 4 when I'm sitting. Maybe a 6 when I walk on it."

**When the AI asks about what they've done so far:**
> "I iced it last night and took some Advil. It's a little better today honestly."

**When the AI asks about ability to bear weight:**
> "Yeah, I can put weight on it. It just doesn't feel great. I definitely can't run or jump."

**When the AI asks about medical history:**
> "Nah, I'm healthy. No allergies. I sprained this same ankle like two years ago but it healed fine."

### Expected Triage Outcome

| Priority | Color | Reasoning |
|----------|-------|-----------|
| **Less Urgent** | 🟡 YELLOW | Lateral ankle injury with swelling and ecchymosis, but weight-bearing preserved. History of inversion mechanism with audible pop suggests possible ligament sprain (Grade I–II). No signs of fracture per Ottawa ankle rules (can bear weight). Needs X-ray to rule out fracture but not time-critical. |

### Demo Talking Points

- **Lead with:** *"The AI correctly identifies this as non-emergency but is still thorough."*
- **Voice input moment:** *"Let me speak Jake's response instead of typing — this is how a real patient might interact."* [use mic]
- Note the AI still asks about mechanism of injury, weight-bearing status, and prior injuries — it's not lazy just because the case seems simple.
- Point out the YELLOW (not GREEN) — there's still a pop and swelling, so it warrants medical attention, just not urgently.
- *"The AI essentially applied the Ottawa ankle rules here without being explicitly told to."*

---

## 🟢 Scenario 4: Non-Urgent — Cold Symptoms

### Patient Persona

| Field | Detail |
|-------|--------|
| **Name** | Maria Gonzalez |
| **Age** | 45 |
| **Personality** | Cautious, polite, slightly apologetic for "wasting time." Thorough in her answers. Worried it might be COVID or flu. |

### Script

**Opening line:**
> "Hi, I'm sorry to bother you. I've had a runny nose and a cough for about two days now and I just want to make sure it's nothing serious."

**When the AI asks about symptoms:**
> "It's a stuffy, runny nose — clear mucus mostly. A dry cough that's a little worse at night. And I feel a bit warm."

**When the AI asks about fever:**
> "I checked this morning — 99.8°F. So a low-grade fever. Nothing too high."

**When the AI asks about severity:**
> "Honestly, maybe a 3 out of 10. I feel kind of crummy but I've been going to work."

**When the AI asks about other symptoms (shortness of breath, body aches, etc.):**
> "A little achy, like when you have a cold. No trouble breathing. No chest pain or anything like that."

**When the AI asks about medical history or risk factors:**
> "I'm generally healthy. No chronic conditions. I got my flu shot this year. No allergies to medications."

**When the AI asks about exposure or sick contacts:**
> "My daughter had a cold last week, so I probably caught it from her."

### Expected Triage Outcome

| Priority | Color | Reasoning |
|----------|-------|-----------|
| **Non-Urgent** | 🟢 GREEN | Classic upper respiratory infection / common cold: rhinorrhea, dry cough, low-grade fever, known sick contact, no red flags (no dyspnea, no high fever, no immunocompromise). Self-limiting. Symptomatic care appropriate. |

### Demo Talking Points

- **Lead with:** *"Even for simple cases, the AI completes a thorough intake."*
- Point out the AI still screened for red flags (shortness of breath, high fever, chest pain) before classifying as GREEN.
- Highlight that the form is now fully populated — chief complaint, HPI, review of systems, social/exposure history.
- *"A triage nurse in a busy ER would spend 3–5 minutes on this. The AI did it in under a minute, documented everything, and correctly identified it as non-urgent."*
- **"No internet" moment works great here** — toggle airplane mode if you haven't already.

---

## 🛟 Recovery Tips — If Something Goes Wrong

Things break during demos. Here's how to recover smoothly:

| Problem | Recovery | What to Say |
|---------|----------|-------------|
| **Model is slow / long pause** | Switch to a smaller model in settings if available. Or just keep talking to fill the silence. | *"The model is thinking — this is running entirely on-device, so it depends on hardware. On a beefier machine this is instant."* |
| **Model gives a weird or incorrect response** | Rephrase the input and try again. If persistent, restart the conversation. | *"Let me rephrase that — like any AI, clarity helps. Watch how the response improves."* |
| **Mic not working** | Switch to text input immediately. Don't troubleshoot live. | *"Let me switch to text input for now — the voice feature works the same way, just hands-free."* |
| **3D avatar not loading / frozen** | Minimize or ignore it. Focus on the chat and form. | *"The 3D component is a nice-to-have — the core triage intelligence is all in the conversation and form."* |
| **App crashes or freezes** | Refresh the browser. If that fails, have your backup device ready. | *"Let me refresh — one of the joys of a web app is a quick reload gets us right back."* |
| **Form isn't auto-populating** | Point to the chat instead. The triage logic still works. | *"The form sync is a UI feature — the important thing is the AI's triage assessment right here in the chat."* |
| **Someone asks a hard question you don't know** | Be honest. Offer to follow up. | *"Great question — I want to give you an accurate answer, so let me follow up after the demo."* |

---

## 🎬 Recommended Demo Flow

For a **10-minute demo**, run scenarios in this order:

1. **Scenario 1 (Marcus — 🔴 RED)** — Start with the most dramatic. Gets attention.
2. **Scenario 4 (Maria — 🟢 GREEN)** — Contrast with the simplest case. Shows range.
3. **Scenario 2 (Sarah — 🟠 ORANGE)** — The "smart AI" moment. Best for impressing technical audiences.
4. **Scenario 3 (Jake — 🟡 YELLOW)** — End casual and fun. Good energy to close on.

For a **5-minute demo**, run only Scenarios 1 and 2.

For a **2-minute lightning talk**, run only Scenario 1 and narrate over it.

---

*Last updated: Demo Day prep. Break a leg! 🎤*
