"""
model_loader.py

Load KEDUA model (link checker + text checker) SEKALI saat server startup.
Bukan tiap request -- itu yang bikin lambat kalau di-load ulang terus.
"""

import os
import torch

import sys
# Tambahkan root project ke sys.path supaya import ml.* bisa jalan
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from ml.model_link_checker import ModelLinkChecker
from ml.model_text_checker import ModelTextChecker, load_model_untuk_prediksi

device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

# Simpan referensi global supaya bisa diakses dari routes
model_link: ModelLinkChecker = None
model_text: ModelTextChecker = None
tokenizer_text = None


def load_semua_model():
    """
    Dipanggil sekali saat startup FastAPI (lihat main.py).
    Load kedua model ke memori.
    """
    global model_link, model_text, tokenizer_text

    models_dir = os.path.join(BASE_DIR, "models")

    # --- Model Link Checker ---
    link_model_path = os.path.join(models_dir, "model_link_checker.pt")
    print(f"Loading model link checker dari: {link_model_path}")
    model_link = ModelLinkChecker()
    model_link.load_state_dict(torch.load(link_model_path, map_location=device))
    model_link.to(device)
    model_link.eval()
    print("Model link checker siap.")

    # --- Model Text Checker (IndoBERT) ---
    text_model_path = os.path.join(models_dir, "model_text_checker.pt")
    tokenizer_path = os.path.join(models_dir, "tokenizer_text_checker")
    print(f"Loading model text checker dari: {text_model_path}")
    model_text, tokenizer_text = load_model_untuk_prediksi(
        model_path=text_model_path,
        tokenizer_path=tokenizer_path
    )
    print("Model text checker (IndoBERT) siap.")

    print("Semua model siap.")
