"""
dataset.py
Dataset class PyTorch, baca dari data/processed/ (yang sudah digabung
prepare_dataset.py).
"""

import pandas as pd
import torch
from pathlib import Path
from PIL import Image
from torch.utils.data import Dataset

BASE_DIR = Path(__file__).resolve().parent.parent
PROCESSED_DIR = BASE_DIR / "data" / "processed"


class AntiScamDataset(Dataset):
    def __init__(self, url_tokenizer, content_tokenizer, csv_path=None):
        path = csv_path or PROCESSED_DIR / "antiscam_dataset.csv"
        self.df = pd.read_csv(path).fillna({
            "url": "", "website_text": "", "has_form": 0, "has_password_input": 0,
            "has_sensitive_input": 0, "form_action_external": 0, "label": 0
        })
        self.url_tokenizer = url_tokenizer
        self.content_tokenizer = content_tokenizer

    def __len__(self):
        return len(self.df)

    def __getitem__(self, idx):
        row = self.df.iloc[idx]

        u_in = self.url_tokenizer(
            str(row["url"]), padding="max_length", truncation=True,
            max_length=128, return_tensors="pt"
        )
        c_in = self.content_tokenizer(
            str(row["website_text"]), padding="max_length", truncation=True,
            max_length=512, return_tensors="pt"
        )

        form_features = torch.tensor([
            float(row["has_form"]), float(row["has_password_input"]),
            float(row["has_sensitive_input"]), float(row["form_action_external"])
        ], dtype=torch.float)

        return {
            "url_ids": u_in["input_ids"].squeeze(0),
            "url_mask": u_in["attention_mask"].squeeze(0),
            "content_ids": c_in["input_ids"].squeeze(0),
            "content_mask": c_in["attention_mask"].squeeze(0),
            "form_features": form_features,
            "label": torch.tensor(float(row["label"]), dtype=torch.float)
        }


class DeepfakeDataset(Dataset):
    def __init__(self, processor, csv_path=None):
        path = csv_path or PROCESSED_DIR / "deepfake_dataset.csv"
        self.df = pd.read_csv(path)
        self.processor = processor

    def __len__(self):
        return len(self.df)

    def __getitem__(self, idx):
        row = self.df.iloc[idx]
        image = Image.open(row["image_path"]).convert("RGB")
        item = {k: v.squeeze(0) for k, v in self.processor(images=image, return_tensors="pt").items()}
        item["labels"] = torch.tensor(int(row["label"]), dtype=torch.long)
        return item
