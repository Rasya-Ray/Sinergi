import os
import psycopg2
from fastapi import APIRouter
from pydantic import BaseModel
from schemas.security import ScanRequest, ScanResult, ChatRequest, ChatResponse, ClassifyRequest, ClassifyResult
from services.scanner import SecurityScanner
from services.classifier import DomainClassifier
from services.chat import ChatService
from services.ai_service import AIService
from services.dns_service import DNSService
from services.tls_service import TLSService
from services.password_service import PasswordService

router = APIRouter()

DB_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://neondb_owner:npg_Zd4mRIq9PCjk@ep-square-hill-b3y1avud-pooler.c-4.ap-southeast-1.aws.neon.tech/neondb?sslmode=require",
)

scanner = SecurityScanner()
classifier = DomainClassifier()
chat_service = ChatService()
ai_service = AIService()
dns_service = DNSService()
tls_service = TLSService()
password_service = PasswordService()


class DomainRequest(BaseModel):
    domain: str


class PasswordRequest(BaseModel):
    password: str


@router.get("/health")
async def health():
    return {"status": "ok", "service": "nesti-security-scanner", "version": "3.0.0"}


@router.post("/scan", response_model=ScanResult)
async def scan_website(req: ScanRequest):
    result = await scanner.scan(req.url)
    return result


@router.post("/classify", response_model=ClassifyResult)
async def classify_domain(req: ClassifyRequest):
    result = classifier.classify(req.domain)
    return result


@router.post("/dns-check")
async def dns_check(req: DomainRequest):
    result = dns_service.check(req.domain)
    return result


@router.post("/tls-check")
async def tls_check(req: DomainRequest):
    result = tls_service.check(req.domain)
    return result


@router.post("/password-check")
async def password_check(req: PasswordRequest):
    result = password_service.check(req.password)
    return result


@router.post("/chat", response_model=ChatResponse)
async def chat(req: ChatRequest):
    result = await chat_service.chat(req)
    return result


class StyleRequest(BaseModel):
    prompt: str


@router.post("/ai/style")
async def ai_style(req: StyleRequest):
    result = ai_service.generate_ppt_style(req.prompt)
    if result:
        return {"style": result, "source": "ai"}
    return {"style": None, "source": "none"}


class TelegramLinkRequest(BaseModel):
    email: str
    telegram_id: int
    telegram_username: str = ""


@router.post("/telegram/link")
async def telegram_link(req: TelegramLinkRequest):
    conn = psycopg2.connect(DB_URL)
    cur = conn.cursor()
    cur.execute("SELECT id FROM users WHERE email = %s", (req.email,))
    row = cur.fetchone()
    if not row:
        conn.close()
        return {"success": False, "error": "Email not found"}
    cur.execute(
        "UPDATE users SET telegram_id = %s, telegram_username = %s WHERE email = %s",
        (req.telegram_id, req.telegram_username, req.email),
    )
    conn.commit()
    cur.execute(
        """INSERT INTO tg_chat_sessions (telegram_id, user_id)
        VALUES (%s, %s) ON CONFLICT (telegram_id)
        DO UPDATE SET user_id = EXCLUDED.user_id, is_active = TRUE""",
        (req.telegram_id, row[0]),
    )
    conn.commit()
    conn.close()
    return {"success": True}


@router.post("/telegram/unlink")
async def telegram_unlink(email: str):
    conn = psycopg2.connect(DB_URL)
    cur = conn.cursor()
    cur.execute(
        "UPDATE users SET telegram_id = NULL, telegram_username = NULL WHERE email = %s",
        (email,),
    )
    conn.commit()
    conn.close()
    return {"success": True}


@router.get("/telegram/status/{firebase_uid}")
async def telegram_status(firebase_uid: str):
    conn = psycopg2.connect(DB_URL)
    cur = conn.cursor()
    cur.execute(
        "SELECT telegram_id, telegram_username FROM users WHERE firebase_uid = %s",
        (firebase_uid,),
    )
    row = cur.fetchone()
    conn.close()
    if not row:
        return {"linked": False}
    if row[0]:
        return {"linked": True, "telegram_id": row[0], "telegram_username": row[1]}
    return {"linked": False}
