"""
main.py

Entry point FastAPI.
Cara jalankan: uvicorn api.main:app --reload
(dari folder anti-scam-project)
"""

import os
import sys

# Pastikan root project ada di sys.path supaya import ml.* dan api.* bisa jalan
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.model_loader import load_semua_model
from api.routes.check_link import router as check_link_router

app = FastAPI(title="Anti Scam Checker API")

# CORS supaya frontend Next.js (beda origin/port) bisa akses backend ini
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # untuk development; di production ganti ke domain frontend spesifik
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================
# LOAD MODEL SEKALI SAAT SERVER NYALA
# ============================================
@app.on_event("startup")
def startup_event():
    load_semua_model()


# ============================================
# ROUTES
# ============================================
app.include_router(check_link_router)


@app.get("/")
def root():
    return {"message": "Anti Scam Checker API aktif"}
