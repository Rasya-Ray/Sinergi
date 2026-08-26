"""
agent_deepfake.py
Model di-load SEKALI saat AgentDeepfake() dibuat (dipanggil sekali di
app.py saat server start), lalu dipakai berkali-kali lewat predict()
tanpa reload ulang tiap request.
"""

import torch
from pathlib import Path
from PIL import Image
from transformers import AutoImageProcessor

from src.models.deepfake_model import load_deepfake_model, DEEPFAKE_MODEL_NAME

BASE_DIR = Path(__file__).resolve().parent.parent
CHECKPOINT_PATH = BASE_DIR / "experiments" / "checkpoints" / "deepfake" / "model.pt"

device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
id2label = {0: "fake", 1: "real"}


class AgentDeepfake:
    def __init__(self):
        self.processor = AutoImageProcessor.from_pretrained(DEEPFAKE_MODEL_NAME)
        # freeze_backbone tidak berpengaruh ke hasil inference (cuma
        # relevan pas training), tetap ditulis eksplisit biar konsisten
        # dengan cara train.py membuat model yang sama.
        self.model = load_deepfake_model(freeze_backbone=False)

        if CHECKPOINT_PATH.exists():
            self.model.load_state_dict(torch.load(CHECKPOINT_PATH, map_location=device))
            print(f"[AgentDeepfake] Checkpoint fine-tuning dimuat: {CHECKPOINT_PATH}")
        else:
            print("[AgentDeepfake] Belum ada checkpoint fine-tuning, pakai model pretrained bawaan.")

        self.model.to(device)
        self.model.eval()

    def predict(self, image_path: str) -> dict:
        if not Path(image_path).exists():
            raise FileNotFoundError(f"File gambar tidak ditemukan: {image_path}")

        image = Image.open(image_path).convert("RGB")
        inputs = self.processor(images=image, return_tensors="pt").to(device)

        with torch.no_grad():
            logits = self.model(**inputs).logits
            probs = torch.softmax(logits, dim=1).squeeze().tolist()

        skor = {id2label[i]: round(probs[i], 4) for i in range(len(probs))}
        fake_score = skor.get("fake", 0.0)
        real_score = skor.get("real", 0.0)
        is_real = real_score >= fake_score

        return {
            "image_path": image_path,
            "real_score": real_score,
            "fake_score": fake_score,
            "is_real": is_real,
            "status": "Asli (Real)" if is_real else "Manipulasi (Deepfake)"
        }

    def reload_checkpoint(self) -> bool:
        """Dipanggil setelah training baru selesai, ambil weight terbaru dari disk."""
        if CHECKPOINT_PATH.exists():
            self.model.load_state_dict(torch.load(CHECKPOINT_PATH, map_location=device))
            self.model.eval()
            return True
        return False
