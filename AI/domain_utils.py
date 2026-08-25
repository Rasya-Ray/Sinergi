"""
domain_utils.py
Modul untuk normalisasi domain (termasuk homograph/Unicode trick)
dan perbandingan kemiripan pakai Levenshtein Distance.
"""

import unicodedata
import idna
from urllib.parse import urlparse
from rapidfuzz.distance import Levenshtein


def ekstrak_domain(url_atau_teks: str) -> str:
    """
    Ambil domain murni dari URL atau teks yang mengandung link.
    Contoh: "https://dana.com/login" -> "dana.com"
    """
    teks = url_atau_teks.strip()

    # Kalau nggak ada scheme (http/https), tambahin biar urlparse jalan bener
    if not teks.startswith(("http://", "https://")):
        teks = "http://" + teks

    parsed = urlparse(teks)
    domain = parsed.netloc.lower()

    # Buang "www." biar konsisten
    if domain.startswith("www."):
        domain = domain[4:]

    return domain


def normalisasi_unicode(domain: str) -> str:
    """
    Normalisasi karakter Unicode aneh (homograph attack) ke bentuk standar.
    Contoh: karakter Cyrillic 'а' yang keliatan mirip Latin 'a' akan dinormalisasi.

    Catatan: normalisasi NFKC akan mengubah karakter compatibility-nya,
    tapi TIDAK otomatis mengubah huruf dari alfabet lain (misal Cyrillic)
    jadi Latin, karena itu bukan tujuan Unicode normalization.
    Untuk itu kita decode Punycode (xn--) dulu kalau ada.
    """
    try:
        # Kalau domain dalam bentuk Punycode (xn--...), decode dulu ke Unicode asli
        domain_decoded = idna.decode(domain) if domain.startswith("xn--") or "xn--" in domain else domain
    except idna.IDNAError:
        domain_decoded = domain

    # Normalisasi bentuk Unicode standar
    domain_normal = unicodedata.normalize("NFKC", domain_decoded)

    return domain_normal


def deteksi_karakter_mencurigakan(domain: str) -> dict:
    """
    Cek apakah domain mengandung karakter non-ASCII (indikasi homograph attack).
    Mengembalikan info karakter apa yang mencurigakan.
    """
    karakter_aneh = []
    for char in domain:
        # Karakter ASCII normal ada di range 0-127
        if ord(char) > 127:
            nama_unicode = unicodedata.name(char, "TIDAK DIKENALI")
            karakter_aneh.append({
                "karakter": char,
                "kode_unicode": f"U+{ord(char):04X}",
                "nama": nama_unicode
            })

    return {
        "ada_karakter_mencurigakan": len(karakter_aneh) > 0,
        "detail": karakter_aneh
    }


def hitung_kemiripan(domain_a: str, domain_b: str) -> dict:
    """
    Hitung Levenshtein Distance antara dua domain.
    Distance kecil = mirip. Distance 0 = identik persis.
    """
    distance = Levenshtein.distance(domain_a, domain_b)

    # Similarity ratio: 1.0 = identik, 0.0 = beda total
    similarity = Levenshtein.normalized_similarity(domain_a, domain_b)

    return {
        "domain_a": domain_a,
        "domain_b": domain_b,
        "distance": distance,
        "similarity_persen": round(similarity * 100, 2)
    }


# ---- Contoh pemakaian langsung (buat testing manual) ----
if __name__ == "__main__":
    contoh_link = "https://xn--daa-cma.com/login"  # ini contoh domain dengan karakter unicode

    domain = ekstrak_domain(contoh_link)
    print(f"Domain diekstrak: {domain}")

    domain_normal = normalisasi_unicode(domain)
    print(f"Setelah normalisasi: {domain_normal}")

    cek_karakter = deteksi_karakter_mencurigakan(domain_normal)
    print(f"Cek karakter mencurigakan: {cek_karakter}")

    perbandingan = hitung_kemiripan(domain_normal, "dana.com")
    print(f"Perbandingan ke 'dana.com': {perbandingan}")
