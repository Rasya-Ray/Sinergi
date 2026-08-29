"""
prepare_dataset.py
Gabungkan raw dataset menjadi format siap training.

Kolom CSV tidak perlu punya nama tertentu.
- URL dataset: kolom pertama = URL, kolom terakhir = label
- Text dataset: kolom pertama = teks, kolom terakhir = label
"""

import pandas as pd
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
RAW_DIR = BASE_DIR / "data" / "raw"
PROCESSED_DIR = BASE_DIR / "data" / "processed"


def gabungkan_dataset_antiscam():
    baris_gabungan = []

    path_url = RAW_DIR / "antiscam_url_dataset.csv"

    if path_url.exists():
        df = pd.read_csv(path_url)

        kolom_data = df.columns[0]
        kolom_label = df.columns[-1]

        for _, row in df.iterrows():
            baris_gabungan.append({
                "url": row[kolom_data],
                "website_text": "",
                "has_form": 0,
                "has_password_input": 0,
                "has_sensitive_input": 0,
                "form_action_external": 0,
                "label": row[kolom_label]
            })

        print(
            f"URL: {kolom_data} | "
            f"Label: {kolom_label} | "
            f"{len(df)} baris"
        )

    path_text = RAW_DIR / "antiscam_text_dataset.csv"

    if path_text.exists():
        df = pd.read_csv(path_text)

        kolom_data = df.columns[0]
        kolom_label = df.columns[-1]

        for _, row in df.iterrows():
            baris_gabungan.append({
                "url": "",
                "body_text": row[kolom_data],
                "has_form": 0,
                "has_password_input": 0,
                "has_sensitive_input": 0,
                "form_action_external": 0,
                "label": row[kolom_label]
            })

        print(
            f"Teks: {kolom_data} | "
            f"Label: {kolom_label} | "
            f"{len(df)} baris"
        )

    path_combined = RAW_DIR / "antiscam_combined_raw.csv"

    if path_combined.exists():
        df = pd.read_csv(path_combined)

        baris_gabungan.extend(
            df.to_dict("records")
        )

        print(
            f"Combined: {len(df)} baris"
        )

    if not baris_gabungan:
        print("Tidak ada dataset antiscam.")
        return

    df_final = pd.DataFrame(baris_gabungan)

    PROCESSED_DIR.mkdir(
        parents=True,
        exist_ok=True
    )

    output_path = (
        PROCESSED_DIR /
        "antiscam_dataset.csv"
    )

    df_final.to_csv(
        output_path,
        index=False
    )

    print(
        f"Total antiscam: {len(df_final)} baris"
    )

    print(
        f"Disimpan: {output_path}"
    )


def gabungkan_dataset_deepfake():
    baris = []

    fake_dir = (
        RAW_DIR /
        "deepfake" /
        "fake"
    )

    real_dir = (
        RAW_DIR /
        "deepfake" /
        "real"
    )

    if fake_dir.exists():
        for p in fake_dir.rglob("*"):
            if p.suffix.lower() in {
                ".jpg",
                ".jpeg",
                ".png",
                ".webp"
            }:
                baris.append({
                    "image_path": str(p),
                    "label": 0
                })

    if real_dir.exists():
        for p in real_dir.rglob("*"):
            if p.suffix.lower() in {
                ".jpg",
                ".jpeg",
                ".png",
                ".webp"
            }:
                baris.append({
                    "image_path": str(p),
                    "label": 1
                })

    if not baris:
        print("Tidak ada gambar deepfake.")
        return

    df = pd.DataFrame(baris)

    PROCESSED_DIR.mkdir(
        parents=True,
        exist_ok=True
    )

    output_path = (
        PROCESSED_DIR /
        "deepfake_dataset.csv"
    )

    df.to_csv(
        output_path,
        index=False
    )

    print(
        f"Total deepfake: {len(df)} baris"
    )

    print(
        f"Disimpan: {output_path}"
    )


if __name__ == "__main__":
    gabungkan_dataset_antiscam()
    gabungkan_dataset_deepfake()