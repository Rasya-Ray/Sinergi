"""
agent_antiscam.py
Sama polanya dengan agent_deepfake.py: model + tokenizer di-load SEKALI
di __init__, dipakai berkali-kali lewat predict().
"""

import torch
from pathlib import Path
from transformers import AutoTokenizer

from src.models.antiscam_model import HybridAntiScamModel, URL_MODEL_NAME, CONTENT_MODEL_NAME

BASE_DIR = Path(__file__).resolve().parent.parent
CHECKPOINT_PATH = BASE_DIR / "experiments" / "checkpoints" / "antiscam" / "model.pt"

device = torch.device("cuda" if torch.cuda.is_available() else "cpu")


class AgentAntiScam:
    def __init__(self):
        if not CHECKPOINT_PATH.exists():
            raise FileNotFoundError(
                f"Checkpoint belum ada di {CHECKPOINT_PATH}. "
                f"Jalankan 'python train.py --target antiscam' dulu sebelum serving."
            )

        self.url_tokenizer = AutoTokenizer.from_pretrained(URL_MODEL_NAME)
        self.content_tokenizer = AutoTokenizer.from_pretrained(CONTENT_MODEL_NAME)
        self.model = HybridAntiScamModel()
        self.model.load_state_dict(torch.load(CHECKPOINT_PATH, map_location=device))
        self.model.to(device)
        self.model.eval()

    def predict(self, json_data: dict) -> dict:
        url = json_data.get("url", "")
        body_text = json_data.get("body_text", "")

        form_info = json_data.get("form_data", {})
        f1 = 1.0 if form_info.get("has_form", False) else 0.0
        f2 = 1.0 if form_info.get("has_password_input", False) else 0.0
        f3 = 1.0 if form_info.get("has_sensitive_input", False) else 0.0
        f4 = 1.0 if form_info.get("form_action_external", False) else 0.0

        form_tensor = torch.tensor([[f1, f2, f3, f4]], dtype=torch.float).to(device)

        url_inputs = self.url_tokenizer(
            url, padding="max_length", truncation=True, max_length=128, return_tensors="pt"
        ).to(device)
        content_inputs = self.content_tokenizer(
            body_text, padding="max_length", truncation=True, max_length=512, return_tensors="pt"
        ).to(device)

        with torch.no_grad():
            prob = self.model(
                url_inputs["input_ids"], url_inputs["attention_mask"],
                content_inputs["input_ids"], content_inputs["attention_mask"],
                form_tensor
            )

        score = round(prob.item(), 4)
        is_safe = score >= 0.5

        return {
            "url": url,
            "safety_score": score,
            "is_safe": is_safe,
            "status": "Aman" if is_safe else "Scam / Phishing Berbahaya"
        }

    def reload_checkpoint(self):
        """Dipanggil setelah training baru selesai, ambil weight terbaru dari disk."""
        self.model.load_state_dict(torch.load(CHECKPOINT_PATH, map_location=device))
        self.model.eval()
