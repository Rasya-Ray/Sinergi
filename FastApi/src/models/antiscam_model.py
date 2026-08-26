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
    def __init__(self):
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

    def forward(self, url_ids, url_mask, content_ids, content_mask, form_features):
        url_logits = self.url_model(input_ids=url_ids, attention_mask=url_mask).logits
        url_scores = torch.softmax(url_logits, dim=1)

        content_out = self.content_model(input_ids=content_ids, attention_mask=content_mask)
        content_embedding = content_out.last_hidden_state[:, 0, :]

        gabungan = torch.cat((url_scores, content_embedding, form_features), dim=1)
        return self.classifier(gabungan)
