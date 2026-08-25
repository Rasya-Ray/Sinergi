"""
model_link_checker.py

Alur SESUAI PERMINTAAN:
1. CSV berisi url + label (scam/aman)
2. Tiap url diekstrak jadi angka-angka (fitur) pakai domain_utils.py
3. Model belajar dari fitur-fitur itu (neural network sederhana, BUKAN IndoBERT
   -- karena ini cuma link/domain, bukan kalimat panjang, jadi nggak butuh
   model bahasa yang besar)
4. Model disimpan
5. Nanti di FastAPI: endpoint /check-link terima link dari frontend,
   ekstrak fitur pakai fungsi yang SAMA, masukkan ke model, kembalikan
   persentase ke frontend
"""

import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import Dataset, DataLoader
import pandas as pd
from sklearn.model_selection import train_test_split

from domain_utils import ekstrak_domain, normalisasi_unicode, deteksi_karakter_mencurigakan, hitung_kemiripan

device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

# Daftar TLD yang sering dipakai situs scam (fitur tambahan, seperti yang
# kita bahas di kasus link gopay25.ejcx.top kemarin)
TLD_MENCURIGAKAN = [".top", ".xyz", ".click", ".info", ".tk", ".ml", ".ga", ".cf"]

# Daftar domain resmi sebagai pembanding (starter -- idealnya nanti diperluas
# atau diganti pendekatan dinamis pakai search_checker.py)
DOMAIN_RESMI_REFERENSI = [
    "gopay.co.id", "dana.id", "ovo.id", "bca.co.id", "bri.co.id",
    "shopee.co.id", "telkomsel.com", "gojek.com", "linkaja.id", "pln.co.id",
    "grab.com", "bpjsketenagakerjaan.go.id", "tokopedia.com", "blibli.com",
    "bankmandiri.co.id", "bni.co.id", "kominfo.go.id", "pajak.go.id"
]


# ============================================
# BAGIAN 1: Ekstraksi fitur dari SATU URL
# (fungsi ini yang dipanggil PERSIS SAMA baik saat training maupun saat
#  prediksi live -- ini alasannya dipisah, biar konsisten di kedua tempat)
# ============================================
def ekstrak_fitur_url(url: str) -> list:
    """
    Ubah 1 URL jadi angka-angka (fitur) yang bisa dibaca model.
    Total 6 fitur numerik.
    """
    domain = ekstrak_domain(url)
    domain_normal = normalisasi_unicode(domain)

    # Fitur 1: apakah ada karakter unicode aneh (homograph attack)
    cek_karakter = deteksi_karakter_mencurigakan(domain_normal)
    fitur_karakter_aneh = 1.0 if cek_karakter["ada_karakter_mencurigakan"] else 0.0

    # Fitur 2: apakah pakai TLD yang mencurigakan
    fitur_tld_mencurigakan = 1.0 if any(domain_normal.endswith(tld) for tld in TLD_MENCURIGAKAN) else 0.0

    # Fitur 3: jarak (Levenshtein) TERKECIL ke semua domain resmi referensi
    jarak_terkecil = min(
        hitung_kemiripan(domain_normal, resmi)["distance"]
        for resmi in DOMAIN_RESMI_REFERENSI
    )
    fitur_jarak = min(jarak_terkecil / 15.0, 1.0)  # normalisasi ke skala 0-1

    # Fitur 4: apakah domain PERSIS SAMA dengan salah satu domain resmi
    fitur_exact_match = 1.0 if domain_normal in DOMAIN_RESMI_REFERENSI else 0.0

    # Fitur 5: apakah nama salah satu brand resmi "nyempil" di subdomain/nama
    #          tapi domain utamanya beda total (pola kasus gopay25.ejcx.top)
    nama_brand_list = [d.split(".")[0] for d in DOMAIN_RESMI_REFERENSI]
    fitur_brand_di_nama_tapi_bukan_resmi = 0.0
    if fitur_exact_match == 0.0:
        for brand in nama_brand_list:
            if brand in domain_normal:
                fitur_brand_di_nama_tapi_bukan_resmi = 1.0
                break

    # Fitur 6: panjang domain (situs scam kadang pakai domain panjang/aneh)
    fitur_panjang_domain = min(len(domain_normal) / 40.0, 1.0)

    return [
        fitur_karakter_aneh,
        fitur_tld_mencurigakan,
        fitur_jarak,
        fitur_exact_match,
        fitur_brand_di_nama_tapi_bukan_resmi,
        fitur_panjang_domain
    ]


JUMLAH_FITUR = 6


# ============================================
# BAGIAN 2: Dataset class
# ============================================
class LinkDataset(Dataset):
    def __init__(self, urls, labels):
        self.urls = urls
        self.labels = labels

    def __len__(self):
        return len(self.urls)

    def __getitem__(self, idx):
        fitur = ekstrak_fitur_url(self.urls[idx])
        return {
            "fitur": torch.tensor(fitur, dtype=torch.float32),
            "label": torch.tensor(self.labels[idx], dtype=torch.long)
        }


# ============================================
# BAGIAN 3: CLASS MODEL (neural network sederhana -- BUKAN IndoBERT)
# Karena input cuma 6 angka, model kecil ini sudah lebih dari cukup
# ============================================
class ModelLinkChecker(nn.Module):
    def __init__(self, jumlah_fitur=JUMLAH_FITUR, jumlah_kelas=2):
        super().__init__()
        self.hidden1 = nn.Linear(jumlah_fitur, 16)
        self.aktivasi1 = nn.ReLU()
        self.hidden2 = nn.Linear(16, 8)
        self.aktivasi2 = nn.ReLU()
        self.output = nn.Linear(8, jumlah_kelas)

    def forward(self, x):
        x = self.hidden1(x)
        x = self.aktivasi1(x)
        x = self.hidden2(x)
        x = self.aktivasi2(x)
        x = self.output(x)
        return x


# ============================================
# BAGIAN 4: CLASS TRAINER
# ============================================
class Trainer:
    def __init__(self, model, learning_rate=0.01):
        self.model = model.to(device)
        self.loss_function = nn.CrossEntropyLoss()
        self.optimizer = optim.Adam(model.parameters(), lr=learning_rate)

    def satu_langkah_backprop(self, batch):
        fitur = batch["fitur"].to(device)
        labels = batch["label"].to(device)

        prediksi = self.model(fitur)
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
                fitur = batch["fitur"].to(device)
                labels = batch["label"].to(device)
                prediksi = torch.argmax(self.model(fitur), dim=1)
                benar += (prediksi == labels).sum().item()
                total += labels.size(0)
        return benar / total

    def simpan_model(self, path="./model_link_checker.pt"):
        torch.save(self.model.state_dict(), path)
        print(f"Model tersimpan ke: {path}")


# ============================================
# BAGIAN 5: Load dataset dari CSV
# ============================================
def load_dataset(csv_path):
    df = pd.read_csv(csv_path)
    train_urls, val_urls, train_labels, val_labels = train_test_split(
        df["url"].tolist(), df["label"].tolist(),
        test_size=0.2, random_state=42, stratify=df["label"]
    )
    return train_urls, val_urls, train_labels, val_labels


# ============================================
# BAGIAN 6: Fungsi prediksi (dipakai di endpoint /check-link nanti)
# ============================================
def cek_link(url: str, model: ModelLinkChecker) -> dict:
    model.eval()
    fitur = torch.tensor([ekstrak_fitur_url(url)], dtype=torch.float32).to(device)

    with torch.no_grad():
        output = model(fitur)
        persen = torch.softmax(output, dim=1)

    label_map = {0: "aman", 1: "scam"}
    prediksi_idx = torch.argmax(persen, dim=1).item()

    return {
        "url": url,
        "label": label_map[prediksi_idx],
        "persen_aman": round(persen[0][0].item() * 100, 2),
        "persen_scam": round(persen[0][1].item() * 100, 2)
    }


# ============================================
# JALANKAN TRAINING
# ============================================
if __name__ == "__main__":
    print(f"Device: {device}")

    train_urls, val_urls, train_labels, val_labels = load_dataset("dataset_link_scam.csv")
    print(f"Data training: {len(train_urls)}, Data validasi: {len(val_urls)}")

    train_dataset = LinkDataset(train_urls, train_labels)
    val_dataset = LinkDataset(val_urls, val_labels)

    train_loader = DataLoader(train_dataset, batch_size=8, shuffle=True)
    val_loader = DataLoader(val_dataset, batch_size=8)

    model = ModelLinkChecker()
    trainer = Trainer(model, learning_rate=0.01)

    trainer.training_loop(train_loader, val_loader, jumlah_epoch=50)
    trainer.simpan_model("./model_link_checker.pt")

    print("\n=== Test dengan link dari percakapan kita sebelumnya ===")
    hasil = cek_link("https://gopay25.ejcx.top/?bagi-saldo=42", model)
    print(hasil)

    print("\n=== Test dengan link resmi ===")
    hasil2 = cek_link("https://www.gopay.co.id/promo", model)
    print(hasil2)
