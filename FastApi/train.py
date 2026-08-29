"""
train.py
Satu entry point untuk training kedua model. Pilih target lewat argumen:

    python train.py --target antiscam
    python train.py --target deepfake

Checkpoint tersimpan di experiments/checkpoints/<target>/model.pt
Log tersimpan di experiments/logs/<target>.log
"""

import argparse
import sys
import torch
import torch.nn as nn
from pathlib import Path
from torch.optim import AdamW
from torch.utils.data import DataLoader
from tqdm import tqdm
from transformers import AutoTokenizer, AutoImageProcessor

BASE_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(BASE_DIR))

from src.dataset import AntiScamDataset, DeepfakeDataset
from src.models.antiscam_model import HybridAntiScamModel, URL_MODEL_NAME, CONTENT_MODEL_NAME
from src.models.deepfake_model import load_deepfake_model
from src.utils import hitung_akurasi_biner, hitung_akurasi_kelas

device = torch.device("cuda" if torch.cuda.is_available() else "cpu")


def tulis_log(target, pesan):
    log_dir = BASE_DIR / "experiments" / "logs"
    log_dir.mkdir(parents=True, exist_ok=True)
    print(pesan)
    with open(log_dir / f"{target}.log", "a") as f:
        f.write(pesan + "\n")


def train_antiscam(jumlah_epoch=3, batch_size=8, learning_rate=2e-5, freeze_backbone=True):
    checkpoint_dir = BASE_DIR / "experiments" / "checkpoints" / "antiscam"
    checkpoint_path = checkpoint_dir / "model.pt"

    url_tokenizer = AutoTokenizer.from_pretrained(URL_MODEL_NAME)
    content_tokenizer = AutoTokenizer.from_pretrained(CONTENT_MODEL_NAME)

    dataset = AntiScamDataset(url_tokenizer, content_tokenizer)
    dataloader = DataLoader(dataset, batch_size=batch_size, shuffle=True)

    model = HybridAntiScamModel(freeze_backbone=freeze_backbone).to(device)
    if checkpoint_path.exists():
        model.load_state_dict(torch.load(checkpoint_path, map_location=device))
        tulis_log("antiscam", f"Lanjut training dari checkpoint: {checkpoint_path}")

    mode_teks = "backbone dibekukan, cuma classifier belajar (cepat)" if freeze_backbone else "seluruh model belajar (lambat, lebih akurat kalau data banyak)"
    tulis_log("antiscam", f"Mode training: {mode_teks}")

    parameter_yang_dilatih = filter(lambda p: p.requires_grad, model.parameters())
    optimizer = AdamW(parameter_yang_dilatih, lr=learning_rate)
    criterion = nn.BCELoss()

    model.train()
    for epoch in range(jumlah_epoch):
        total_loss, total_akurasi = 0, 0
        # tqdm: nampilin progress bar per-batch, biar keliatan lagi jalan
        # (bukan diem doang sampe 1 epoch penuh selesai)
        progress_bar = tqdm(dataloader, desc=f"Epoch {epoch+1}/{jumlah_epoch}")
        for batch in progress_bar:
            optimizer.zero_grad()
            output = model(
                batch["url_ids"].to(device), batch["url_mask"].to(device),
                batch["content_ids"].to(device), batch["content_mask"].to(device),
                batch["form_features"].to(device)
            )
            label = batch["label"].to(device).unsqueeze(1)
            loss = criterion(output, label)
            loss.backward()
            optimizer.step()

            total_loss += loss.item()
            total_akurasi += hitung_akurasi_biner(output, label)
            progress_bar.set_postfix(loss=f"{loss.item():.4f}")

        rata_loss = total_loss / len(dataloader)
        rata_akurasi = total_akurasi / len(dataloader)
        tulis_log("antiscam", f"Epoch {epoch+1}/{jumlah_epoch} - Loss: {rata_loss:.4f} - Akurasi: {rata_akurasi:.2%}")

    checkpoint_dir.mkdir(parents=True, exist_ok=True)
    torch.save(model.state_dict(), checkpoint_path)
    tulis_log("antiscam", f"Model tersimpan di: {checkpoint_path}")


def train_deepfake(jumlah_epoch=3, batch_size=8, learning_rate=1e-5, freeze_backbone=True):
    checkpoint_dir = BASE_DIR / "experiments" / "checkpoints" / "deepfake"
    checkpoint_path = checkpoint_dir / "model.pt"

    processor = AutoImageProcessor.from_pretrained("prithivMLmods/deepfake-detector-model-v1")
    dataset = DeepfakeDataset(processor)
    # num_workers: load gambar di background thread, GPU tidak nunggu CPU
    # pin_memory: mempercepat transfer data ke GPU (VRAM)
    dataloader = DataLoader(dataset, batch_size=batch_size, shuffle=True, num_workers=2, pin_memory=True)

    model = load_deepfake_model(freeze_backbone=freeze_backbone).to(device)
    if checkpoint_path.exists():
        model.load_state_dict(torch.load(checkpoint_path, map_location=device))
        tulis_log("deepfake", f"Lanjut training dari checkpoint: {checkpoint_path}")

    mode_teks = "backbone dibekukan, cuma classifier belajar" if freeze_backbone else "seluruh model belajar"
    tulis_log("deepfake", f"Mode training: {mode_teks}")

    # Optimizer cuma dikasih parameter yang requires_grad=True, biar parameter
    # yang dibekukan (freeze_backbone=True) tidak ikut dihitung optimizer
    parameter_yang_dilatih = filter(lambda p: p.requires_grad, model.parameters())
    optimizer = AdamW(parameter_yang_dilatih, lr=learning_rate)

    # Mixed precision: hitung sebagian pakai angka 16-bit, bukan 32-bit,
    # bisa menghemat VRAM sampai ~40-50% dengan akurasi hampir sama
    pakai_amp = device.type == "cuda"
    scaler = torch.cuda.amp.GradScaler(enabled=pakai_amp)

    model.train()
    for epoch in range(jumlah_epoch):
        total_loss, total_akurasi = 0, 0
        progress_bar = tqdm(dataloader, desc=f"Epoch {epoch+1}/{jumlah_epoch}")
        for batch in progress_bar:
            optimizer.zero_grad()

            with torch.autocast(device_type=device.type, enabled=pakai_amp):
                output = model(pixel_values=batch["pixel_values"].to(device), labels=batch["labels"].to(device))
                loss = output.loss

            scaler.scale(loss).backward()
            scaler.step(optimizer)
            scaler.update()

            total_loss += loss.item()
            total_akurasi += hitung_akurasi_kelas(output.logits, batch["labels"].to(device))
            progress_bar.set_postfix(loss=f"{loss.item():.4f}")

        rata_loss = total_loss / len(dataloader)
        rata_akurasi = total_akurasi / len(dataloader)
        tulis_log("deepfake", f"Epoch {epoch+1}/{jumlah_epoch} - Loss: {rata_loss:.4f} - Akurasi: {rata_akurasi:.2%}")

    checkpoint_dir.mkdir(parents=True, exist_ok=True)
    torch.save(model.state_dict(), checkpoint_path)
    tulis_log("deepfake", f"Model tersimpan di: {checkpoint_path}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--target", choices=["antiscam", "deepfake"], required=True)
    parser.add_argument("--epoch", type=int, default=3)
    parser.add_argument("--batch-size", type=int, default=8)
    parser.add_argument("--freeze-backbone", action="store_true", default=None,
                         help="Bekukan backbone pretrained, cuma classifier yang dilatih (jauh lebih cepat). Default: True untuk antiscam, False untuk deepfake.")
    args = parser.parse_args()

    print(f"Device: {device}")

    if args.target == "antiscam":
        freeze = True if args.freeze_backbone is None else args.freeze_backbone
        train_antiscam(jumlah_epoch=args.epoch, batch_size=args.batch_size, freeze_backbone=freeze)
    else:
        freeze = True if args.freeze_backbone is None else args.freeze_backbone
        train_deepfake(jumlah_epoch=args.epoch, batch_size=args.batch_size, freeze_backbone=freeze)
