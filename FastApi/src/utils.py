"""
utils.py
Fungsi metrik dasar buat evaluasi training.
"""

import torch


def hitung_akurasi_biner(prediksi, label, threshold=0.5):
    """Untuk model yang outputnya probabilitas 0-1 (antiscam)."""
    pred_kelas = (prediksi >= threshold).float()
    benar = (pred_kelas == label).sum().item()
    return benar / len(label)


def hitung_akurasi_kelas(logits, label):
    """Untuk model klasifikasi banyak kelas (deepfake, logits belum softmax)."""
    pred_kelas = torch.argmax(logits, dim=1)
    benar = (pred_kelas == label).sum().item()
    return benar / len(label)
