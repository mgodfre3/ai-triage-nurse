from pydantic import BaseModel, Field
from enum import Enum
from typing import Optional, List, Any
from datetime import datetime


class TriagePriority(str, Enum):
    GREEN = "green"       # Non-urgent
    YELLOW = "yellow"     # Less urgent
    ORANGE = "orange"     # Urgent
    RED = "red"           # Emergency
    UNASSIGNED = "unassigned"


class Vitals(BaseModel):
    temperature_f: Optional[float] = None
    blood_pressure: Optional[str] = None
    heart_rate: Optional[int] = None
    o2_saturation: Optional[int] = None
    respiratory_rate: Optional[int] = None


class TriageIntakeForm(BaseModel):
    patient_name: Optional[str] = None
    age: Optional[int] = None
    sex: Optional[str] = None
    chief_complaint: Optional[str] = None
    symptom_details: List[str] = Field(default_factory=list)
    symptom_duration: Optional[str] = None
    pain_level: Optional[int] = None  # 1-10
    vitals: Vitals = Field(default_factory=Vitals)
    medical_history: List[str] = Field(default_factory=list)
    allergies: List[str] = Field(default_factory=list)
    current_medications: List[str] = Field(default_factory=list)
    triage_priority: TriagePriority = TriagePriority.UNASSIGNED
    triage_reasoning: Optional[str] = None
    timestamp: datetime = Field(default_factory=datetime.now)


class FormUpdate(BaseModel):
    """Sent to frontend when a form field is updated by the AI."""
    field_path: str       # e.g. "patient_name", "vitals.heart_rate"
    value: Any            # the new value
    display_label: str    # human-readable label


class WSMessage(BaseModel):
    """WebSocket message envelope."""
    type: str             # "chat_token", "form_update", "triage_set", "transcript", "error", "session_reset"
    data: dict = Field(default_factory=dict)
