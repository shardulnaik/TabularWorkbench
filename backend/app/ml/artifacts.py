from __future__ import annotations

from pathlib import Path

import numpy as np

from app.storage.local_artifacts import artifact_store


def save_split_manifest(dataset_id: str, run_id: str, manifest: dict, train_positions: list[int], test_positions: list[int]) -> tuple[Path, Path]:
    manifest_path = artifact_store.save_json(dataset_id, f"model_run_{run_id}_manifest.json", manifest)
    split_path = artifact_store.path(dataset_id, f"model_run_{run_id}_split.npz")
    np.savez_compressed(split_path, train_positions=np.asarray(train_positions, dtype=np.int64), test_positions=np.asarray(test_positions, dtype=np.int64))
    return manifest_path, split_path


def load_split_positions(path: str) -> tuple[list[int], list[int]]:
    artifact = Path(path).resolve()
    if artifact_store.root not in artifact.parents or not artifact.is_file():
        raise FileNotFoundError("The model comparison split has expired. Run model comparison again.")
    with np.load(artifact, allow_pickle=False) as values:
        return values["train_positions"].astype(int).tolist(), values["test_positions"].astype(int).tolist()
