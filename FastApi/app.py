"""
app.py
REST API FastAPI, dipanggil Express.js sebagai AI microservice.
Kedua agent (deepfake, antiscam) di-instantiate SEKALI saat server start,
model tetap di memori selama server jalan -- tidak reload tiap request.

Jalankan: uvicorn app:app --reload --port 8000
"""

import sys
from pathlib import Path
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

BASE_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(BASE_DIR))

from agents.agent_deepfake import AgentDeepfake
from agents.agent_antiscam import AgentAntiScam

app = FastAPI(title="Sinergi AI API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # development; di production ganti ke domain Express spesifik
    allow_methods=["*"],
    allow_headers=["*"],
)

print("Loading agent deepfake...")
agent_deepfake = AgentDeepfake()
print("Loading agent antiscam...")
agent_antiscam = AgentAntiScam()
print("Semua agent siap, server bisa dipakai.")


class AntiScamInput(BaseModel):
    url: str
    header_text: str = ""
    body_text: str = ""
    # popup_text: str = ""
    form_data: dict = {}


@app.post("/check-link")
def check_link(data: AntiScamInput):
    return agent_antiscam.predict(data.dict())


@app.post("/check-image")
async def check_image(file: UploadFile = File(...)):
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File yang diupload harus berupa gambar")

    upload_dir = BASE_DIR / "uploads"
    upload_dir.mkdir(parents=True, exist_ok=True)
    upload_path = upload_dir / file.filename

    with open(upload_path, "wb") as f:
        f.write(await file.read())

    try:
        hasil = agent_deepfake.predict(str(upload_path))
    finally:
        upload_path.unlink(missing_ok=True)  # hapus file setelah diproses, hemat disk

    return hasil


@app.post("/reload-antiscam-model")
def reload_antiscam_model():
    """Panggil setelah training baru selesai, biar server pakai weight terbaru."""
    agent_antiscam.reload_checkpoint()
    return {"reloaded": True}


@app.post("/reload-deepfake-model")
def reload_deepfake_model():
    agent_deepfake.reload_checkpoint()
    return {"reloaded": True}


@app.get("/health")
def health_check():
    return {"status": "ok"}


@app.get("/")
def root():
    return {"message": "Sinergi AI API aktif", "agents": ["deepfake", "antiscam"]}
