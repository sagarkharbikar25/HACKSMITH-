"""
Vector mathematics and clustering utilities.
Zero-dependency / pure numpy implementations for cosine distance and leader clustering.
"""
from typing import List
import numpy as np

def cosine_similarity(a: List[float] | np.ndarray, b: List[float] | np.ndarray) -> float:
    """Compute cosine similarity between two 1D vectors."""
    va = np.asarray(a, dtype=float)
    vb = np.asarray(b, dtype=float)
    norm_a = np.linalg.norm(va)
    norm_b = np.linalg.norm(vb)
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return float(np.dot(va, vb) / (norm_a * norm_b))

def leader_cluster(vecs: np.ndarray, threshold: float = 0.78) -> List[List[int]]:
    """
    Greedy leader clustering algorithm.
    Groups vectors by cosine similarity exceeding the threshold.
    Returns list of index lists sorted by cluster size descending.
    """
    if len(vecs) == 0:
        return []

    arr = np.asarray(vecs, dtype=float)
    norms = np.linalg.norm(arr, axis=1, keepdims=True)
    norms[norms == 0] = 1e-12
    normed = arr / norms

    leaders: List[np.ndarray] = []
    groups: List[List[int]] = []

    for idx, vec in enumerate(normed):
        if leaders:
            sims = np.array(leaders) @ vec
            best_idx = int(sims.argmax())
            if sims[best_idx] >= threshold:
                groups[best_idx].append(idx)
                continue

        leaders.append(vec)
        groups.append([idx])

    return sorted(groups, key=len, reverse=True)

