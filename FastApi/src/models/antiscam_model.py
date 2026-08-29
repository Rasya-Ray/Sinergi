"""
antiscam_model.py
Gabungan kmack (analisis URL) + IndoBERT (analisis konteks teks).
"""

import torch
import torch.nn as nn
from transformers import AutoModelForSequenceClassification, AutoModel

URL_MODEL_NAME = "kmack/malicious-url-detection"
CONTENT_MODEL_NAME = "indobenchmark/indobert-base-p2"


class HybridAntiScamModel(nn.Module):
    def __init__(self, freeze_backbone=True):
        super().__init__()
        self.url_model = AutoModelForSequenceClassification.from_pretrained(URL_MODEL_NAME)
        self.content_model = AutoModel.from_pretrained(CONTENT_MODEL_NAME)

        jumlah_kelas_url = self.url_model.config.num_labels

        self.classifier = nn.Sequential(
            nn.Linear(jumlah_kelas_url + 768 + 4, 256),
            nn.ReLU(),
            nn.Dropout(0.2),
            nn.Linear(256, 1),
            nn.Sigmoid()
        )

        # Default freeze_backbone=True: kmack & IndoBERT sudah "pintar"
        # duluan (pretrained), tidak perlu dilatih ulang -- cuma classifier
        # kecil di atasnya yang belajar. Training jauh lebih cepat karena
        # gradient nggak perlu dihitung untuk ~180 juta parameter backbone,
        # cuma untuk classifier (~200 ribu parameter).
        if freeze_backbone:
            self.freeze_backbone()

    def freeze_backbone(self):
        for p in self.url_model.parameters():
            p.requires_grad = False
        for p in self.content_model.parameters():
            p.requires_grad = False

    def unfreeze_backbone(self):
        for p in self.url_model.parameters():
            p.requires_grad = True
        for p in self.content_model.parameters():
            p.requires_grad = True

    def forward(self, url_ids, url_mask, content_ids, content_mask, form_features):
        url_logits = self.url_model(input_ids=url_ids, attention_mask=url_mask).logits
        url_scores = torch.softmax(url_logits, dim=1)

        content_out = self.content_model(input_ids=content_ids, attention_mask=content_mask)
        content_embedding = content_out.last_hidden_state[:, 0, :]

        gabungan = torch.cat((url_scores, content_embedding, form_features), dim=1)
        return self.classifier(gabungan)
