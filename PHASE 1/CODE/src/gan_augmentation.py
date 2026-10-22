"""
PureBreath-AI: Week 4 - GAN Data Augmentation Module

Trains a Conditional GAN (cGAN) on the cleaned AQI dataset to generate
synthetic air quality samples, augmenting underrepresented AQI categories.
Saves the combined real + synthetic dataset for downstream training.

Author: PureBreath-AI Team
License: MIT
"""

import os
import json
import logging
import numpy as np
import pandas as pd
import torch
import torch.nn as nn
from torch.utils.data import DataLoader, TensorDataset
from sklearn.preprocessing import StandardScaler, LabelEncoder

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.StreamHandler()]
)

# ── Reproducibility ────────────────────────────────────────────────────────────
SEED = 42
torch.manual_seed(SEED)
np.random.seed(SEED)

# ── Hyper-parameters ───────────────────────────────────────────────────────────
LATENT_DIM   = 64
HIDDEN_DIM   = 256
BATCH_SIZE   = 256
EPOCHS       = 500
LR           = 2e-4
DEVICE       = torch.device("cuda" if torch.cuda.is_available() else "cpu")

FEATURE_COLS = [
    "PM2.5", "PM10", "NO", "NO2", "NOx", "NH3", "CO", "SO2", "O3",
    "Benzene", "Toluene", "Xylene",
    "temp_mean_c", "temp_min_c", "temp_max_c", "precipitation_mm", "pressure_hgt",
]
LABEL_COL    = "AQI_Bucket"
SAMPLES_PER_CLASS = 500          # synthetic samples to generate per AQI class


# ── Architecture ───────────────────────────────────────────────────────────────

class Generator(nn.Module):
    def __init__(self, latent_dim: int, n_classes: int, out_dim: int, hidden: int):
        super().__init__()
        self.label_emb = nn.Embedding(n_classes, n_classes)
        self.net = nn.Sequential(
            nn.Linear(latent_dim + n_classes, hidden),
            nn.LayerNorm(hidden),
            nn.LeakyReLU(0.2),
            nn.Linear(hidden, hidden),
            nn.LayerNorm(hidden),
            nn.LeakyReLU(0.2),
            nn.Linear(hidden, out_dim),
        )

    def forward(self, z: torch.Tensor, labels: torch.Tensor) -> torch.Tensor:
        c = self.label_emb(labels)
        return self.net(torch.cat([z, c], dim=1))


class Discriminator(nn.Module):
    def __init__(self, in_dim: int, n_classes: int, hidden: int):
        super().__init__()
        self.label_emb = nn.Embedding(n_classes, n_classes)
        self.net = nn.Sequential(
            nn.Linear(in_dim + n_classes, hidden),
            nn.LeakyReLU(0.2),
            nn.Dropout(0.3),
            nn.Linear(hidden, hidden // 2),
            nn.LeakyReLU(0.2),
            nn.Dropout(0.3),
            nn.Linear(hidden // 2, 1),
            nn.Sigmoid(),
        )

    def forward(self, x: torch.Tensor, labels: torch.Tensor) -> torch.Tensor:
        c = self.label_emb(labels)
        return self.net(torch.cat([x, c], dim=1))


# ── Data helpers ───────────────────────────────────────────────────────────────

def load_features(filepath: str):
    """Load cleaned dataset and return scaled features, encoded labels, helpers."""
    df = pd.read_csv(filepath)
    df = df.dropna(subset=FEATURE_COLS + [LABEL_COL])

    le = LabelEncoder()
    labels = le.fit_transform(df[LABEL_COL].astype(str))

    scaler = StandardScaler()
    features = scaler.fit_transform(df[FEATURE_COLS].values.astype(np.float32))

    logging.info(f"Loaded {len(df)} samples | Classes: {list(le.classes_)}")
    class_counts = pd.Series(labels).value_counts().sort_index()
    for idx, cnt in class_counts.items():
        logging.info(f"  [{le.classes_[idx]}] → {cnt} samples")

    return features, labels, le, scaler, df


# ── Training ───────────────────────────────────────────────────────────────────

def train_cgan(features: np.ndarray, labels: np.ndarray, n_classes: int):
    """Train Conditional GAN and return trained Generator."""
    feat_tensor  = torch.tensor(features, dtype=torch.float32)
    label_tensor = torch.tensor(labels,   dtype=torch.long)

    dataset    = TensorDataset(feat_tensor, label_tensor)
    dataloader = DataLoader(dataset, batch_size=BATCH_SIZE, shuffle=True, drop_last=True)

    out_dim = features.shape[1]
    G = Generator(LATENT_DIM, n_classes, out_dim, HIDDEN_DIM).to(DEVICE)
    D = Discriminator(out_dim, n_classes, HIDDEN_DIM).to(DEVICE)

    opt_G = torch.optim.Adam(G.parameters(), lr=LR, betas=(0.5, 0.999))
    opt_D = torch.optim.Adam(D.parameters(), lr=LR, betas=(0.5, 0.999))
    criterion = nn.BCELoss()

    for epoch in range(1, EPOCHS + 1):
        g_losses, d_losses = [], []

        for real_x, real_y in dataloader:
            real_x, real_y = real_x.to(DEVICE), real_y.to(DEVICE)
            bs = real_x.size(0)

            real_lbl = torch.ones(bs, 1, device=DEVICE)
            fake_lbl = torch.zeros(bs, 1, device=DEVICE)

            # ── Train Discriminator ──────────────────────────────────────────
            z      = torch.randn(bs, LATENT_DIM, device=DEVICE)
            fake_x = G(z, real_y).detach()

            d_real = criterion(D(real_x, real_y), real_lbl)
            d_fake = criterion(D(fake_x, real_y), fake_lbl)
            d_loss = (d_real + d_fake) / 2

            opt_D.zero_grad()
            d_loss.backward()
            opt_D.step()

            # ── Train Generator ──────────────────────────────────────────────
            z      = torch.randn(bs, LATENT_DIM, device=DEVICE)
            fake_x = G(z, real_y)
            g_loss = criterion(D(fake_x, real_y), real_lbl)

            opt_G.zero_grad()
            g_loss.backward()
            opt_G.step()

            g_losses.append(g_loss.item())
            d_losses.append(d_loss.item())

        if epoch % 100 == 0:
            logging.info(
                f"Epoch [{epoch:>4}/{EPOCHS}] "
                f"G_loss: {np.mean(g_losses):.4f} | D_loss: {np.mean(d_losses):.4f}"
            )

    return G


# ── Synthesis ──────────────────────────────────────────────────────────────────

def generate_synthetic(
    G: Generator,
    le: LabelEncoder,
    scaler: StandardScaler,
    samples_per_class: int,
) -> pd.DataFrame:
    """Generate synthetic samples for every AQI class and inverse-transform."""
    G.eval()
    n_classes   = len(le.classes_)
    all_samples = []

    with torch.no_grad():
        for class_idx in range(n_classes):
            z      = torch.randn(samples_per_class, LATENT_DIM, device=DEVICE)
            labels = torch.full((samples_per_class,), class_idx, dtype=torch.long, device=DEVICE)
            fake   = G(z, labels).cpu().numpy()
            fake   = scaler.inverse_transform(fake)

            df_syn = pd.DataFrame(fake, columns=FEATURE_COLS)
            df_syn[LABEL_COL] = le.classes_[class_idx]
            all_samples.append(df_syn)

    synthetic_df = pd.concat(all_samples, ignore_index=True)
    logging.info(f"Generated {len(synthetic_df)} synthetic samples across {n_classes} classes.")
    return synthetic_df


# ── Main pipeline ──────────────────────────────────────────────────────────────

def run_gan_augmentation(
    input_path:  str = "datasets/processed/cleaned_dataset.csv",
    output_path: str = "datasets/processed/augmented_dataset.csv",
    meta_path:   str = "models/gan_augmentation_meta.json",
):
    logging.info("=== Week 4: GAN Data Augmentation ===")
    logging.info(f"Device: {DEVICE}")

    # 1. Load data
    features, labels, le, scaler, df_real = load_features(input_path)
    n_classes = len(le.classes_)

    # 2. Train cGAN
    logging.info(f"Training cGAN for {EPOCHS} epochs …")
    G = train_cgan(features, labels, n_classes)

    # 3. Generate synthetic samples
    df_synthetic = generate_synthetic(G, le, scaler, SAMPLES_PER_CLASS)
    df_synthetic["source"] = "synthetic"
    df_real["source"]      = "real"

    # 4. Merge and save
    keep_cols = FEATURE_COLS + [LABEL_COL, "source"]
    df_real_slim = df_real[keep_cols].copy()
    df_augmented = pd.concat([df_real_slim, df_synthetic], ignore_index=True)
    df_augmented.to_csv(output_path, index=False)
    logging.info(f"Augmented dataset saved → '{output_path}' ({len(df_augmented)} rows)")

    # 5. Save metadata
    os.makedirs(os.path.dirname(meta_path), exist_ok=True)
    meta = {
        "real_samples":      int(len(df_real)),
        "synthetic_samples": int(len(df_synthetic)),
        "total_samples":     int(len(df_augmented)),
        "aqi_classes":       list(le.classes_),
        "samples_per_class": SAMPLES_PER_CLASS,
        "feature_cols":      FEATURE_COLS,
        "epochs":            EPOCHS,
        "latent_dim":        LATENT_DIM,
        "device":            str(DEVICE),
    }
    with open(meta_path, "w") as f:
        json.dump(meta, f, indent=4)
    logging.info(f"GAN metadata saved → '{meta_path}'")

    return df_augmented


if __name__ == "__main__":
    run_gan_augmentation(
        input_path  = "datasets/processed/cleaned_dataset.csv",
        output_path = "datasets/processed/augmented_dataset.csv",
        meta_path   = "models/gan_augmentation_meta.json",
    )
