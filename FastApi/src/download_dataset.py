"""
download_dataset.py

Download dataset dari HuggingFace langsung ke data/raw/.
Ubah variabel di bagian atas sesuai dataset yang mau diambil, lalu jalankan:

    python src/download_dataset.py
"""

from pathlib import Path
from datasets import load_dataset

# ======== UBAH BAGIAN INI SESUAI DATASET YANG MAU DIDOWNLOAD ========

DATASET_REPO = "kmack/Phishing_urls"   # nama repo dataset di HuggingFace
SPLIT = "train"
OUTPUT_MODE = "csv"                    # "csv" untuk data tabular, "images" untuk dataset gambar

# --- dipakai kalau OUTPUT_MODE = "csv" ---
OUTPUT_FILENAME = "antiscam_url_dataset.csv"

# --- dipakai kalau OUTPUT_MODE = "images" ---
IMAGE_COLUMN = "image"
LABEL_COLUMN = "label"
LABEL_TO_FOLDER = {0: "fake", 1: "real"}   # sesuaikan urutan label dataset aslinya
OUTPUT_IMAGE_SUBFOLDER = "deepfake"

# ======================================================================

BASE_DIR = Path(__file__).resolve().parent.parent
RAW_DIR = BASE_DIR / "data" / "raw"


def simpan_sebagai_csv(ds):
    df = ds.to_pandas()
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    output_path = RAW_DIR / OUTPUT_FILENAME
    df.to_csv(output_path, index=False)
    print(f"Tersimpan: {output_path} ({len(df)} baris)")
    print(f"Kolom: {df.columns.tolist()}")


def simpan_sebagai_gambar(ds):
    output_dir = RAW_DIR / OUTPUT_IMAGE_SUBFOLDER
    for folder_nama in set(LABEL_TO_FOLDER.values()):
        (output_dir / folder_nama).mkdir(parents=True, exist_ok=True)

    jumlah = {folder: 0 for folder in set(LABEL_TO_FOLDER.values())}

    for i, contoh in enumerate(ds):
        label = contoh[LABEL_COLUMN]
        folder_tujuan = LABEL_TO_FOLDER.get(label)
        if folder_tujuan is None:
            continue

        gambar = contoh[IMAGE_COLUMN]
        path_output = output_dir / folder_tujuan / f"{i}.jpg"
        gambar.convert("RGB").save(path_output)
        jumlah[folder_tujuan] += 1

    for folder, total in jumlah.items():
        print(f"{folder}: {total} gambar tersimpan di {output_dir / folder}")


def download():
    print(f"Download dataset: {DATASET_REPO} (split={SPLIT})")
    ds = load_dataset(DATASET_REPO, split=SPLIT)

    if OUTPUT_MODE == "csv":
        simpan_sebagai_csv(ds)
    elif OUTPUT_MODE == "images":
        simpan_sebagai_gambar(ds)
    else:
        raise ValueError(f"OUTPUT_MODE tidak dikenali: {OUTPUT_MODE}")


if __name__ == "__main__":
    download()
