import json
import logging
from typing import AsyncGenerator, List

from app.foundry_manager import FoundryManager
from app.models import (
    FormUpdate,
    TriageIntakeForm,
    TriagePriority,
    WSMessage,
)

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# System prompt
# ---------------------------------------------------------------------------
SYSTEM_PROMPT = """\
You are **Nurse Ada**, a professional AI triage nurse in a hospital emergency \
department intake simulation.

**Your responsibilities:**
1. Greet the patient warmly and introduce yourself.
2. Systematically gather the following information, asking ONE focused question \
at a time (never a barrage of questions):
   - Patient name
   - Age and sex
   - Chief complaint (why they are here today)
   - Detailed symptom description
   - Symptom duration / onset
   - Pain level (1-10 scale)
   - Relevant medical history
   - Allergies
   - Current medications
3. As the patient answers, use the provided tools to record each piece of \
information on the intake form immediately.
4. After gathering sufficient information, use the `set_triage_priority` tool \
to assign a triage level (green / yellow / orange / red) with your reasoning.

**Rules:**
- Be empathetic, calm, and professional.
- Ask only ONE question per response.
- NEVER provide medical advice, a diagnosis, or treatment recommendations.
- Always remind the patient that this is a simulation and they should seek \
real medical attention for actual health concerns.
- Use tools to record data as soon as the patient provides it.
"""

# ---------------------------------------------------------------------------
# Tool definitions (OpenAI function-calling format)
# ---------------------------------------------------------------------------
TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "update_intake_form",
            "description": (
                "Update a single field on the patient intake form. "
                "Use this whenever the patient provides personal or medical information."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "field_name": {
                        "type": "string",
                        "description": (
                            "The intake-form field to update. One of: "
                            "patient_name, age, sex, chief_complaint, "
                            "symptom_duration, pain_level, medical_history, "
                            "allergies, current_medications"
                        ),
                    },
                    "value": {
                        "description": "The new value (string, number, or list of strings).",
                    },
                },
                "required": ["field_name", "value"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "set_triage_priority",
            "description": (
                "Assign a triage priority level once enough information has "
                "been gathered. Call this exactly once per session."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "level": {
                        "type": "string",
                        "enum": ["green", "yellow", "orange", "red"],
                        "description": "The triage priority level.",
                    },
                    "reasoning": {
                        "type": "string",
                        "description": "Brief clinical reasoning for the assigned level.",
                    },
                },
                "required": ["level", "reasoning"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "add_symptom",
            "description": "Add a symptom description to the symptom details list.",
            "parameters": {
                "type": "object",
                "properties": {
                    "symptom": {
                        "type": "string",
                        "description": "A description of the symptom.",
                    },
                },
                "required": ["symptom"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "record_vitals",
            "description": "Record one or more vital-sign readings.",
            "parameters": {
                "type": "object",
                "properties": {
                    "temperature_f": {
                        "type": "number",
                        "description": "Temperature in °F.",
                    },
                    "blood_pressure": {
                        "type": "string",
                        "description": "Blood pressure reading, e.g. '120/80'.",
                    },
                    "heart_rate": {
                        "type": "integer",
                        "description": "Heart rate in bpm.",
                    },
                    "o2_saturation": {
                        "type": "integer",
                        "description": "Oxygen saturation percentage.",
                    },
                },
            },
        },
    },
]

# Friendly display labels for form fields
_DISPLAY_LABELS = {
    "patient_name": "Patient Name",
    "age": "Age",
    "sex": "Sex",
    "chief_complaint": "Chief Complaint",
    "symptom_details": "Symptoms",
    "symptom_duration": "Symptom Duration",
    "pain_level": "Pain Level",
    "medical_history": "Medical History",
    "allergies": "Allergies",
    "current_medications": "Current Medications",
    "vitals.temperature_f": "Temperature (°F)",
    "vitals.blood_pressure": "Blood Pressure",
    "vitals.heart_rate": "Heart Rate",
    "vitals.o2_saturation": "O₂ Saturation",
    "triage_priority": "Triage Priority",
}


# ---------------------------------------------------------------------------
# Triage session
# ---------------------------------------------------------------------------
class TriageSession:
    """Manages a single triage conversation with tool-calling support."""

    def __init__(self) -> None:
        self.form = TriageIntakeForm()
        self.messages: List[dict] = [
            {"role": "system", "content": SYSTEM_PROMPT},
        ]

    # ------------------------------------------------------------------
    # Public entry point
    # ------------------------------------------------------------------
    async def process_message(self, user_text: str) -> AsyncGenerator[WSMessage, None]:
        """Process a user message and yield WSMessage objects."""
        self.messages.append({"role": "user", "content": user_text})

        manager = FoundryManager.get_instance()
        client = manager.get_chat_client()
        model = manager.get_chat_model()

        # Tool-calling loop: keep calling the model until it stops
        # requesting tool calls and produces a final text response.
        final_text = ""
        async for event in self._handle_tool_calls(client, model):
            yield event

        # After the loop, the last assistant message contains the text reply.
        last_msg = self.messages[-1]
        if last_msg["role"] == "assistant" and last_msg.get("content"):
            final_text = last_msg["content"]

        # Stream the final text character-by-character for a typing effect.
        for char in final_text:
            yield WSMessage(type="chat_token", data={"token": char})

    # ------------------------------------------------------------------
    # Tool-calling loop
    # ------------------------------------------------------------------
    MAX_TOOL_ROUNDS = 10  # prevent infinite loops from bad model output

    async def _handle_tool_calls(self, client, model: str) -> AsyncGenerator[WSMessage, None]:
        """Call the model in a loop, executing any requested tools each turn."""
        for _round in range(self.MAX_TOOL_ROUNDS):
            try:
                response = client.chat.completions.create(
                    model=model,
                    messages=self.messages,
                    tools=TOOLS,
                )
            except Exception as e:
                logger.error("Foundry Local API error: %s", e)
                self.messages.append({
                    "role": "assistant",
                    "content": (
                        "I'm sorry, I'm having trouble connecting to my AI service right now. "
                        "Please ensure Foundry Local is running and try again. "
                        f"(Error: {type(e).__name__})"
                    ),
                })
                return

            choice = response.choices[0]
            message = choice.message

            # Append the raw assistant message (may contain tool_calls).
            self.messages.append(message.to_dict() if hasattr(message, "to_dict") else {
                "role": "assistant",
                "content": message.content or "",
                **({"tool_calls": [
                    {
                        "id": tc.id,
                        "type": "function",
                        "function": {
                            "name": tc.function.name,
                            "arguments": tc.function.arguments,
                        },
                    }
                    for tc in message.tool_calls
                ]} if message.tool_calls else {}),
            })

            # If the model didn't request any tool calls, we're done.
            if not message.tool_calls:
                return

            # Execute each requested tool and feed results back.
            for tool_call in message.tool_calls:
                fn_name = tool_call.function.name
                try:
                    args = json.loads(tool_call.function.arguments)
                except json.JSONDecodeError:
                    # Bad JSON from model — return error to model, don't mutate state
                    self.messages.append({
                        "role": "tool",
                        "tool_call_id": tool_call.id,
                        "content": "ERROR: malformed JSON arguments — please retry with valid JSON",
                    })
                    continue

                result_text, events = self._execute_tool(fn_name, args)

                # Yield any form-update / triage events to the frontend.
                for evt in events:
                    yield evt

                # Append the tool result so the model can continue.
                self.messages.append({
                    "role": "tool",
                    "tool_call_id": tool_call.id,
                    "content": result_text,
                })

        # Exhausted MAX_TOOL_ROUNDS — force stop and warn
        yield WSMessage(type="error", data={
            "message": "Triage session hit tool-call limit. Please try again."
        })

    # ------------------------------------------------------------------
    # Tool implementations
    # ------------------------------------------------------------------
    def _execute_tool(self, name: str, args: dict) -> tuple[str, list[WSMessage]]:
        """Run a tool and return (result_text, list_of_ws_events)."""
        handler = {
            "update_intake_form": self._tool_update_intake_form,
            "set_triage_priority": self._tool_set_triage_priority,
            "add_symptom": self._tool_add_symptom,
            "record_vitals": self._tool_record_vitals,
        }.get(name)

        if handler is None:
            logger.warning("Unknown tool requested: %s", name)
            return f"Error: unknown tool '{name}'", []

        return handler(args)

    def _tool_update_intake_form(self, args: dict) -> tuple[str, list[WSMessage]]:
        field_name: str = args.get("field_name", "")
        value = args.get("value")
        events: list[WSMessage] = []

        # Validate the field exists on the form
        if field_name not in self.form.model_fields:
            return f"Error: unknown field '{field_name}'", events

        # For list fields, ensure the value is a list and extend
        current = getattr(self.form, field_name)
        if isinstance(current, list):
            if isinstance(value, list):
                current.extend(value)
            else:
                current.append(value)
            value = current  # report full list
        else:
            setattr(self.form, field_name, value)

        label = _DISPLAY_LABELS.get(field_name, field_name)
        events.append(WSMessage(
            type="form_update",
            data=FormUpdate(
                field_path=field_name,
                value=value,
                display_label=label,
            ).model_dump(),
        ))
        return f"Recorded {field_name} = {value}", events

    def _tool_set_triage_priority(self, args: dict) -> tuple[str, list[WSMessage]]:
        level_str: str = args.get("level", "green")
        reasoning: str = args.get("reasoning", "")
        events: list[WSMessage] = []

        try:
            priority = TriagePriority(level_str)
        except ValueError:
            return f"ERROR: invalid triage level '{level_str}'. Must be one of: green, yellow, orange, red", []

        self.form.triage_priority = priority
        self.form.triage_reasoning = reasoning

        events.append(WSMessage(
            type="triage_set",
            data={
                "level": priority.value,
                "reasoning": reasoning,
            },
        ))
        events.append(WSMessage(
            type="form_update",
            data=FormUpdate(
                field_path="triage_priority",
                value=priority.value,
                display_label="Triage Priority",
            ).model_dump(),
        ))
        return f"Triage priority set to {priority.value}: {reasoning}", events

    def _tool_add_symptom(self, args: dict) -> tuple[str, list[WSMessage]]:
        symptom: str = args.get("symptom", "")
        events: list[WSMessage] = []

        self.form.symptom_details.append(symptom)

        events.append(WSMessage(
            type="form_update",
            data=FormUpdate(
                field_path="symptom_details",
                value=self.form.symptom_details,
                display_label="Symptoms",
            ).model_dump(),
        ))
        return f"Added symptom: {symptom}", events

    def _tool_record_vitals(self, args: dict) -> tuple[str, list[WSMessage]]:
        events: list[WSMessage] = []
        recorded: list[str] = []

        for vital_key in ("temperature_f", "blood_pressure", "heart_rate", "o2_saturation"):
            if vital_key in args and args[vital_key] is not None:
                setattr(self.form.vitals, vital_key, args[vital_key])
                field_path = f"vitals.{vital_key}"
                label = _DISPLAY_LABELS.get(field_path, vital_key)
                events.append(WSMessage(
                    type="form_update",
                    data=FormUpdate(
                        field_path=field_path,
                        value=args[vital_key],
                        display_label=label,
                    ).model_dump(),
                ))
                recorded.append(f"{vital_key}={args[vital_key]}")

        summary = ", ".join(recorded) if recorded else "no vitals provided"
        return f"Recorded vitals: {summary}", events
