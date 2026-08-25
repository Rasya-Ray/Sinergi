"""
main.py

FastAPI backend. Endpoint /check-link:
1. Terima URL dari frontend
2. Ekstrak fitur domain (domain_utils.py) -> model_link_checker
3. Fetch & parse isi website (web_fetcher.py) -> model_text_checker (IndoBERT)
4. Gabung kedua hasil prediksi jadi satu kesimpulan
5. Kirim balik ke frontend sebagai JSON

Cara jalankan: uvicorn main:app --reload
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import torch

from domain_utils import ekstrak_domain
from model_link_checker import ModelLinkChecker, cek_link
from model_text_checker import ModelTextChecker, cek_teks, load_model_untuk_prediksi
from web_fetcher import fetch_dan_parse_website

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
# (bukan tiap ada request -- itu yang bikin lambat kalau di-load ulang terus)
# ============================================
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

print("Loading model link checker...")
model_link = ModelLinkChecker()
model_link.load_state_dict(torch.load("model_link_checker.pt", map_location=device))
model_link.to(device)
model_link.eval()

print("Loading model text checker (IndoBERT)...")
model_text, tokenizer_text = load_model_untuk_prediksi(
    model_path="model_text_checker.pt",
    tokenizer_path="tokenizer_text_checker"
)

print("Semua model siap.")


# ============================================
# SCHEMA INPUT
# ============================================
class LinkInput(BaseModel):
    url: str


# ============================================
# ENDPOINT UTAMA
# ============================================
@app.post("/check-link")
def check_link(data: LinkInput):
    url = data.url

    # 1. Prediksi dari fitur domain (cepat, selalu bisa jalan)
    hasil_link = cek_link(url, model_link)

    # 2. Fetch & parse isi website
    hasil_fetch = fetch_dan_parse_website(url)

    # 3. Kalau fetch berhasil, analisis isi teksnya pakai IndoBERT
    hasil_teks = None
    if hasil_fetch["status"] == "berhasil" and hasil_fetch["isi_teks_halaman"]:
        hasil_teks = cek_teks(hasil_fetch["isi_teks_halaman"], model_text, tokenizer_text)

    # 4. Gabungkan skor jadi satu kesimpulan akhir
    kesimpulan = gabungkan_hasil(hasil_link, hasil_teks, hasil_fetch)

    return {
        "url": url,
        "domain": ekstrak_domain(url),
        "hasil_analisis_link": hasil_link,
        "hasil_fetch_website": {
            "status": hasil_fetch["status"],
            "ada_form": hasil_fetch.get("ada_form"),
            "ada_input_password": hasil_fetch.get("ada_input_password"),
        },
        "hasil_analisis_teks": hasil_teks,
        "kesimpulan_akhir": kesimpulan
    }


def gabungkan_hasil(hasil_link: dict, hasil_teks: dict, hasil_fetch: dict) -> dict:
    """
    Logic sederhana menggabungkan skor dari dua model + sinyal tambahan (form/password).
    Ini BUKAN model AI, ini aturan gabung manual (weighted average sederhana).
    """
    skor_scam_link = hasil_link["persen_scam"]

    if hasil_teks is not None:
        skor_scam_teks = hasil_teks["persen_scam"]
        # rata-rata dari dua model, link diberi bobot sedikit lebih tinggi
        # karena selalu tersedia (tidak tergantung fetch berhasil atau tidak)
        skor_gabungan = (skor_scam_link * 0.6) + (skor_scam_teks * 0.4)
    else:
        # fetch gagal -> cuma andalkan hasil analisis link
        skor_gabungan = skor_scam_link

    # Tambahan: kalau ada form + input password, naikkan skor kecurigaan
    if hasil_fetch.get("ada_input_password"):
        skor_gabungan = min(skor_gabungan + 15, 100)

    if skor_gabungan >= 70:
        status = "BERBAHAYA"
    elif skor_gabungan >= 40:
        status = "MENCURIGAKAN"
    else:
        status = "AMAN"

    return {
        "skor_scam_persen": round(skor_gabungan, 2),
        "status": status
    }


@app.get("/")
def root():
    return {"message": "Anti Scam Checker API aktif"}
