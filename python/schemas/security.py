from pydantic import BaseModel, Field
from typing import Optional


class ScanRequest(BaseModel):
    url: str = Field(min_length=1, max_length=2048)


class ScanResult(BaseModel):
    url: str
    status: str = "completed"
    headers: dict = {}
    security_headers: dict = {}
    tls_info: dict = {}
    cookies: list = []
    redirects: list = []
    technologies: list = []
    findings: list = []
    raw_data: dict = {}


class ChatRequest(BaseModel):
    messages: list = []
    message: Optional[str] = None
    parent_id: Optional[str] = None
    history: list = []
    scan_context: dict = {}
    context: dict = {}
    user_name: Optional[str] = None


class ChatResponse(BaseModel):
    reply: str
    session_id: str = ""
    model: str = ""
    provider: str = ""


class ClassifyRequest(BaseModel):
    domain: str = Field(min_length=1, max_length=253)


class ClassifyResult(BaseModel):
    domain: str
    risk: str
    score: float
    warning: str
    categories: list = []
    trust: str = ""
    confidence: float = 0.0
