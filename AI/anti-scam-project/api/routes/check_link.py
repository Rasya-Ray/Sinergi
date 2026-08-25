"""
check_link.py

Endpoint utama: fetch + parse + dua model + gabung skor.
"""

from fastapi import APIRouter
from pydantic import BaseModel

from ml.domain_utils import ekstrak_domain
from ml.model_link_checker import cek_link
from ml.model_text_checker import cek_teks
from ml.web_fetcher import fetch_dan_parse_website
from api.model_loader import model_link, model_text, tokenizer_text

router = APIRouter()


class LinkInput(BaseModel):
    url: str


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


@router.post("/check-link")
def check_link(data: LinkInput):
    # Import ulang dari model_loader supaya dapat referensi terbaru
    # (karena module-level import di atas ambil saat import time, bisa None)
    from api.model_loader import model_link, model_text, tokenizer_text

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
