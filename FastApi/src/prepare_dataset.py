"""
prepare_dataset.py
Gabungkan raw dataset dari 3 sumber jadi format siap training.

Karena dataset kmack (url+label) dan dataset indobert (teks+label)
tidak berpasangan satu sama lain (baris kmack tidak ada teksnya, baris
indobert tidak ada url-nya), keduanya digabung dengan cara mengisi
kolom yang tidak relevan pakai nilai kosong/default. Ini valid karena
kasus nyata di lapangan juga begitu: kadang cuma ada url doang (tanpa
sempat fetch isi halaman), kadang cuma ada teks doang.

Jalankan sekali di awal (atau tiap kali ada raw data baru):
    python src/prepare_dataset.py
"""

import pandas as pd
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
RAW_DIR = BASE_DIR / "data" / "raw"
PROCESSED_DIR = BASE_DIR / "data" / "processed"


def gabungkan_dataset_antiscam():
    """
    Input yang diharapkan ada di data/raw/:
    - antiscam_url_dataset.csv       kolom: url, label      (dari kmack, ~5100 baris)
    - antiscam_text_dataset.csv      kolom: text, label      (dari indobert)
    - antiscam_combined_raw.csv      kolom: url, website_text, has_form,
                                      has_password_input, has_sensitive_input,
                                      form_action_external, label  (opsional,
                                      kalau ada data yang sudah lengkap dari
                                      hasil fetch website beneran)

    Output: data/processed/antiscam_dataset.csv, kolom seragam:
    url, website_text, has_form, has_password_input, has_sensitive_input,
    form_action_external, label
    """
    baris_gabungan = []

    path_url = RAW_DIR / "antiscam_url_dataset.csv"
    if path_url.exists():
        df_url = pd.read_csv(path_url)
        for _, row in df_url.iterrows():
            baris_gabungan.append({
                "url": row["url"], "website_text": "",
                "has_form": 0, "has_password_input": 0,
                "has_sensitive_input": 0, "form_action_external": 0,
                "label": row["label"]
            })
        print(f"Dataset URL (kmack): {len(df_url)} baris ditambahkan")

    path_text = RAW_DIR / "antiscam_text_dataset.csv"
    if path_text.exists():
        df_text = pd.read_csv(path_text)
        for _, row in df_text.iterrows():
            baris_gabungan.append({
                "url": "", "website_text": row["text"],
                "has_form": 0, "has_password_input": 0,
                "has_sensitive_input": 0, "form_action_external": 0,
                "label": row["label"]
            })
        print(f"Dataset teks (IndoBERT): {len(df_text)} baris ditambahkan")

    path_combined = RAW_DIR / "antiscam_combined_raw.csv"
    if path_combined.exists():
        df_combined = pd.read_csv(path_combined)
        baris_gabungan.extend(df_combined.to_dict("records"))
        print(f"Dataset gabungan (url+teks lengkap): {len(df_combined)} baris ditambahkan")

    if not baris_gabungan:
        print("Tidak ada raw dataset antiscam ditemukan di data/raw/, dilewati.")
        return

    df_final = pd.DataFrame(baris_gabungan)
    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
    output_path = PROCESSED_DIR / "antiscam_dataset.csv"
    df_final.to_csv(output_path, index=False)
    print(f"Total dataset antiscam: {len(df_final)} baris -> {output_path}")


def gabungkan_dataset_deepfake():
    """
    Input: folder data/raw/deepfake/real/ dan data/raw/deepfake/fake/
    Output: data/processed/deepfake_dataset.csv, kolom: image_path, label
    (label 0 = fake, 1 = real, konsisten dengan dataset lain)
    """
    baris = []
    fake_dir = RAW_DIR / "deepfake" / "fake"
    real_dir = RAW_DIR / "deepfake" / "real"

    if fake_dir.exists():
        for p in fake_dir.glob("*.[jJ][pP]*[gG]"):
            baris.append({"image_path": str(p), "label": 0})

    if real_dir.exists():
        for p in real_dir.glob("*.[jJ][pP]*[gG]"):
            baris.append({"image_path": str(p), "label": 1})

    if not baris:
        print("Tidak ada gambar ditemukan di data/raw/deepfake/, dilewati.")
        return

    df = pd.DataFrame(baris)
    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
    output_path = PROCESSED_DIR / "deepfake_dataset.csv"
    df.to_csv(output_path, index=False)
    print(f"Total dataset deepfake: {len(df)} baris -> {output_path}")


if __name__ == "__main__":
    gabungkan_dataset_antiscam()
    gabungkan_dataset_deepfake()
