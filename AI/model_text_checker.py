"""
model_text_checker.py

Model untuk analisis TEKS (bukan link) -- dipakai untuk menganalisis
isi konten halaman website hasil fetch (judul, paragraf, dll).

Kenapa IndoBERT: karena inputnya kalimat/paragraf berbahasa Indonesia,
butuh pemahaman konteks bahasa -- beda dari link yang cukup fitur numerik.

Disimpan sebagai .pt (torch.save state_dict), BUKAN save_pretrained(),
sesuai permintaan supaya konsisten dengan model_link_checker.py.
Tokenizer tetap disimpan terpisah karena bukan bagian dari weight model.
"""

import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import Dataset, DataLoader
from transformers import AutoTokenizer, AutoModel
import pandas as pd
from sklearn.model_selection import train_test_split

MODEL_NAME = "indobenchmark/indobert-base-p1"
MAX_LENGTH = 128

device = torch.device("cuda" if torch.cuda.is_available() else "cpu")


# ============================================
# BAGIAN 1: Dataset class
# ============================================
class TextDataset(Dataset):
    def __init__(self, texts, labels, tokenizer, max_length):
        self.texts = texts
        self.labels = labels
        self.tokenizer = tokenizer
        self.max_length = max_length

    def __len__(self):
        return len(self.texts)

    def __getitem__(self, idx):
        text = str(self.texts[idx])
        label = self.labels[idx]

        encoding = self.tokenizer(
            text, truncation=True, padding="max_length",
            max_length=self.max_length, return_tensors="pt"
        )

        return {
            "input_ids": encoding["input_ids"].squeeze(0),
            "attention_mask": encoding["attention_mask"].squeeze(0),
            "label": torch.tensor(label, dtype=torch.long)
        }


# ============================================
# BAGIAN 2: CLASS MODEL (IndoBERT + classifier di atasnya)
# ============================================
class ModelTextChecker(nn.Module):
    def __init__(self, jumlah_kelas=2):
        super().__init__()
        self.bert = AutoModel.from_pretrained(MODEL_NAME)
        hidden_size = self.bert.config.hidden_size  # 768

        self.dropout = nn.Dropout(0.3)
        self.classifier = nn.Linear(hidden_size, jumlah_kelas)  # weight & bias di sini

    def forward(self, input_ids, attention_mask):
        output = self.bert(input_ids=input_ids, attention_mask=attention_mask)
        embedding_cls = output.last_hidden_state[:, 0, :]  # token [CLS]

        x = self.dropout(embedding_cls)
        logits = self.classifier(x)
        return logits


# ============================================
# BAGIAN 3: CLASS TRAINER
# ============================================
class Trainer:
    def __init__(self, model, learning_rate=2e-5):
        self.model = model.to(device)
        self.loss_function = nn.CrossEntropyLoss()
        self.optimizer = optim.AdamW(model.parameters(), lr=learning_rate)

    def satu_langkah_backprop(self, batch):
        input_ids = batch["input_ids"].to(device)
        attention_mask = batch["attention_mask"].to(device)
        labels = batch["label"].to(device)

        prediksi = self.model(input_ids, attention_mask)
        loss = self.loss_function(prediksi, labels)

        self.optimizer.zero_grad()
        loss.backward()
        self.optimizer.step()

        return loss.item()

    def training_loop(self, train_loader, val_loader, jumlah_epoch):
        for epoch in range(jumlah_epoch):
            self.model.train()
            total_loss = 0
            for batch in train_loader:
                total_loss += self.satu_langkah_backprop(batch)

            avg_loss = total_loss / len(train_loader)
            akurasi = self.evaluasi(val_loader)
            print(f"Epoch {epoch + 1}/{jumlah_epoch} - Loss: {avg_loss:.4f} - Akurasi Validasi: {akurasi:.2%}")

    def evaluasi(self, val_loader):
        self.model.eval()
        benar, total = 0, 0
        with torch.no_grad():
            for batch in val_loader:
                input_ids = batch["input_ids"].to(device)
                attention_mask = batch["attention_mask"].to(device)
                labels = batch["label"].to(device)

                prediksi = torch.argmax(self.model(input_ids, attention_mask), dim=1)
                benar += (prediksi == labels).sum().item()
                total += labels.size(0)
        return benar / total

    def simpan_model(self, path="./model_text_checker.pt"):
        """
        Simpan HANYA weight model (.pt). Tokenizer disimpan terpisah
        karena tokenizer bukan angka weight, tapi kamus kata -> token.
        """
        torch.save(self.model.state_dict(), path)
        print(f"Model tersimpan ke: {path}")


def simpan_tokenizer(tokenizer, path="./tokenizer_text_checker"):
    tokenizer.save_pretrained(path)
    print(f"Tokenizer tersimpan ke: {path}")


# ============================================
# BAGIAN 4: Load dataset dari CSV
# ============================================
def load_dataset(csv_path):
    df = pd.read_csv(csv_path)
    train_texts, val_texts, train_labels, val_labels = train_test_split(
        df["text"].tolist(), df["label"].tolist(),
        test_size=0.2, random_state=42, stratify=df["label"]
    )
    return train_texts, val_texts, train_labels, val_labels


# ============================================
# BAGIAN 5: Fungsi load model untuk dipakai backend (INFERENCE)
# ============================================
def load_model_untuk_prediksi(model_path="./model_text_checker.pt", tokenizer_path="./tokenizer_text_checker"):
    tokenizer = AutoTokenizer.from_pretrained(tokenizer_path)

    model = ModelTextChecker()
    model.load_state_dict(torch.load(model_path, map_location=device))
    model.to(device)
    model.eval()

    return model, tokenizer


# ============================================
# BAGIAN 6: Fungsi prediksi
# ============================================
def cek_teks(teks: str, model: ModelTextChecker, tokenizer) -> dict:
    model.eval()
    encoding = tokenizer(
        teks, truncation=True, padding="max_length",
        max_length=MAX_LENGTH, return_tensors="pt"
    ).to(device)

    with torch.no_grad():
        output = model(encoding["input_ids"], encoding["attention_mask"])
        persen = torch.softmax(output, dim=1)

    label_map = {0: "aman", 1: "scam"}
    prediksi_idx = torch.argmax(persen, dim=1).item()

    return {
        "label": label_map[prediksi_idx],
        "persen_aman": round(persen[0][0].item() * 100, 2),
        "persen_scam": round(persen[0][1].item() * 100, 2)
    }


# ============================================
# JALANKAN TRAINING
# ============================================
if __name__ == "__main__":
    print(f"Device: {device}")

    tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)
    train_texts, val_texts, train_labels, val_labels = load_dataset("dataset_scam_starter.csv")
    print(f"Data training: {len(train_texts)}, Data validasi: {len(val_texts)}")

    train_dataset = TextDataset(train_texts, train_labels, tokenizer, MAX_LENGTH)
    val_dataset = TextDataset(val_texts, val_labels, tokenizer, MAX_LENGTH)

    train_loader = DataLoader(train_dataset, batch_size=8, shuffle=True)
    val_loader = DataLoader(val_dataset, batch_size=8)

    model = ModelTextChecker()
    trainer = Trainer(model, learning_rate=2e-5)

    trainer.training_loop(train_loader, val_loader, jumlah_epoch=3)
    trainer.simpan_model("./model_text_checker.pt")
    simpan_tokenizer(tokenizer, "./tokenizer_text_checker")

    print("\n=== Contoh prediksi ===")
    hasil = cek_teks(
        "Selamat anda menang hadiah 10 juta, klik link berikut untuk klaim",
        model, tokenizer
    )
    print(hasil)
