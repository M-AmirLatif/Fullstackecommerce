import json
import os
from typing import List

import faiss
import numpy as np
from pymongo import MongoClient
from sentence_transformers import SentenceTransformer

MONGO_URI = os.getenv("MONGO_URI")
MONGO_DB = os.getenv("MONGO_DB")
MODEL_NAME = os.getenv("AI_MODEL_NAME", "sentence-transformers/all-MiniLM-L6-v2")
INDEX_PATH = os.getenv("AI_INDEX_PATH", "data/faiss.index")
META_PATH = os.getenv("AI_META_PATH", "data/meta.json")


def build_text(doc: dict) -> str:
    parts: List[str] = []
    for key in ("name", "description", "category"):
        value = doc.get(key)
        if value:
            parts.append(str(value))

    highlights = doc.get("highlights") or []
    if isinstance(highlights, list):
        parts.extend([str(item) for item in highlights if item])

    return " ".join(parts).strip()


def main() -> None:
    if not MONGO_URI:
        raise RuntimeError("MONGO_URI is required to build the index.")

    client = MongoClient(MONGO_URI)
    db_name = MONGO_DB or client.get_database().name
    if not db_name:
        raise RuntimeError("MONGO_DB is required when MONGO_URI has no default database.")
    collection = client[db_name]["products"]

    docs = list(collection.find({}))
    if not docs:
        raise RuntimeError("No products found. Seed products before indexing.")

    texts = [build_text(doc) for doc in docs]
    ids = [str(doc["_id"]) for doc in docs]

    model = SentenceTransformer(MODEL_NAME)
    embeddings = model.encode(texts, normalize_embeddings=True)
    embeddings = np.asarray(embeddings, dtype="float32")

    dim = embeddings.shape[1]
    index = faiss.IndexFlatIP(dim)
    index.add(embeddings)

    os.makedirs(os.path.dirname(INDEX_PATH), exist_ok=True)
    faiss.write_index(index, INDEX_PATH)

    os.makedirs(os.path.dirname(META_PATH), exist_ok=True)
    with open(META_PATH, "w", encoding="utf-8") as handle:
        json.dump(ids, handle)

    print(f"Indexed {len(ids)} products into {INDEX_PATH}")


if __name__ == "__main__":
    main()
