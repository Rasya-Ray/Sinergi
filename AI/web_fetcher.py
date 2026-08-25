"""
web_fetcher.py

Fetch halaman website dari URL, lalu ekstrak isinya jadi JSON:
- judul halaman
- teks isi halaman (paragraf digabung)
- apakah ada form (indikasi form login/input data, ciri phishing)
"""

import httpx
from bs4 import BeautifulSoup


def fetch_dan_parse_website(url: str, timeout: int = 10) -> dict:
    """
    Ambil isi halaman website dan ekstrak informasi pentingnya.
    Kalau gagal fetch (timeout, server down, dll), tetap kembalikan
    dict dengan status gagal -- jangan sampai bikin seluruh proses crash.
    """
    try:
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        }
        response = httpx.get(url, headers=headers, timeout=timeout, follow_redirects=True)
        response.raise_for_status()

        soup = BeautifulSoup(response.text, "html.parser")

        # Ambil judul halaman
        judul = soup.title.string.strip() if soup.title and soup.title.string else ""

        # Ambil semua teks paragraf & heading, gabung jadi satu
        tag_teks = soup.find_all(["p", "h1", "h2", "h3", "span", "div"])
        potongan_teks = [tag.get_text(strip=True) for tag in tag_teks if tag.get_text(strip=True)]
        isi_teks = " ".join(potongan_teks)

        # Batasi panjang teks (biar nggak kebanyakan buat masuk ke IndoBERT nanti)
        isi_teks = isi_teks[:2000]

        # Cek apakah ada form (ciri umum halaman phishing minta input data/OTP)
        semua_form = soup.find_all("form")
        ada_form = len(semua_form) > 0

        # Cek apakah ada input password/OTP secara spesifik
        input_password = soup.find_all("input", {"type": "password"})
        ada_input_password = len(input_password) > 0

        return {
            "status": "berhasil",
            "url": url,
            "judul_halaman": judul,
            "isi_teks_halaman": isi_teks,
            "ada_form": ada_form,
            "ada_input_password": ada_input_password,
            "status_code": response.status_code
        }

    except httpx.TimeoutException:
        return {
            "status": "gagal",
            "url": url,
            "alasan": "Timeout, website tidak merespons",
            "isi_teks_halaman": ""
        }
    except httpx.HTTPStatusError as e:
        return {
            "status": "gagal",
            "url": url,
            "alasan": f"HTTP error: {e.response.status_code}",
            "isi_teks_halaman": ""
        }
    except Exception as e:
        return {
            "status": "gagal",
            "url": url,
            "alasan": str(e),
            "isi_teks_halaman": ""
        }


# ---- Contoh pemakaian langsung (testing manual) ----
if __name__ == "__main__":
    hasil = fetch_dan_parse_website("https://www.wikipedia.org/")
    print(f"Status: {hasil['status']}")
    print(f"Judul: {hasil.get('judul_halaman')}")
    print(f"Isi teks (200 char pertama): {hasil.get('isi_teks_halaman', '')[:200]}")
    print(f"Ada form: {hasil.get('ada_form')}")
