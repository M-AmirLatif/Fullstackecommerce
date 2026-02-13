import json
import os

import faiss
import numpy as np
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import requests
from dotenv import load_dotenv
from bson import ObjectId
from pymongo import MongoClient
from sentence_transformers import SentenceTransformer

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

INDEX_PATH = os.getenv("AI_INDEX_PATH", "data/faiss.index")
META_PATH = os.getenv("AI_META_PATH", "data/meta.json")
MODEL_NAME = os.getenv("AI_MODEL_NAME", "sentence-transformers/all-MiniLM-L6-v2")
MONGO_URI = os.getenv("MONGO_URI")
MONGO_DB = os.getenv("MONGO_DB")
AI_LLM_PROVIDER = os.getenv("AI_LLM_PROVIDER", "ollama")
AI_OLLAMA_URL = os.getenv("AI_OLLAMA_URL", "http://127.0.0.1:11434")
AI_OLLAMA_MODEL = os.getenv("AI_OLLAMA_MODEL", "phi3:mini")
AI_CHAT_MODE = os.getenv("AI_CHAT_MODE", "llm")
AI_OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
AI_OPENAI_MODEL = os.getenv("AI_OPENAI_MODEL", "gpt-4o-mini")
AI_DEBUG = os.getenv("AI_DEBUG", "0") == "1"

app = FastAPI()

_index = None
_id_map = []
_model = None
_collection = None


@app.get("/")
def root() -> dict:
    return {"status": "ok", "message": "AI service is running.", "health": "/health"}


class SearchRequest(BaseModel):
    query: str
    top_k: int = 12


class ChatRequest(BaseModel):
    question: str
    top_k: int = 6


class GenerateRequest(BaseModel):
    action: str
    name: str = ""
    category: str = ""
    price: str = ""
    description: str = ""
    highlights: str = ""


@app.on_event("startup")
def load_assets() -> None:
    global _index, _id_map, _model, _collection
    if not os.path.exists(INDEX_PATH) or not os.path.exists(META_PATH):
        return

    _index = faiss.read_index(INDEX_PATH)
    with open(META_PATH, "r", encoding="utf-8") as handle:
        _id_map = json.load(handle)

    _model = SentenceTransformer(MODEL_NAME)
    if MONGO_URI:
        client = MongoClient(MONGO_URI)
        db_name = MONGO_DB or client.get_database().name
        if db_name:
            _collection = client[db_name]["products"]


@app.get("/health")
def health() -> dict:
    return {
        "index_loaded": _index is not None,
        "count": len(_id_map),
        "db_loaded": _collection is not None,
        "llm_provider": AI_LLM_PROVIDER,
        "llm_model": AI_OPENAI_MODEL if AI_LLM_PROVIDER == "openai" else AI_OLLAMA_MODEL,
        "chat_mode": AI_CHAT_MODE,
        "openai_key_loaded": bool(AI_OPENAI_API_KEY) if AI_LLM_PROVIDER == "openai" else False,
        "ai_debug": AI_DEBUG,
    }


@app.post("/ai/search")
def search(req: SearchRequest) -> dict:
    if _index is None or _model is None:
        raise HTTPException(status_code=503, detail="AI index not ready.")

    query = req.query.strip()
    if not query:
        return {"results": []}

    top_k = min(max(req.top_k, 1), len(_id_map))
    if top_k == 0:
        return {"results": []}

    embedding = _model.encode([query], normalize_embeddings=True)
    embedding = np.asarray(embedding, dtype="float32")
    scores, indices = _index.search(embedding, top_k)

    results = []
    for score, idx in zip(scores[0], indices[0]):
        if idx < 0:
            continue
        results.append({"id": _id_map[idx], "score": float(score)})

    return {"results": results}


def _load_products(product_ids):
    if _collection is None or not product_ids:
        return []
    object_ids = []
    for pid in product_ids:
        try:
            object_ids.append(ObjectId(pid))
        except Exception:
            continue
    if not object_ids:
        return []
    cursor = _collection.find(
        {"_id": {"$in": object_ids}},
        {
            "name": 1,
            "price": 1,
            "category": 1,
            "description": 1,
            "stock": 1,
            "inStock": 1,
            "rating": 1,
            "reviewCount": 1,
            "highlights": 1,
            "image": 1,
        },
    )
    products = list(cursor)
    by_id = {str(doc["_id"]): doc for doc in products}
    ordered = [by_id.get(str(pid)) for pid in product_ids]
    return [item for item in ordered if item]


def _format_money(value):
    try:
        return f"${float(value):.2f}"
    except (TypeError, ValueError):
        return "$0.00"


def _build_answer(question, products, scores):
    if not products:
        return (
            "I could not find a close match. Try a category or budget, like "
            "\"headphones under $50\" or \"gift under $30\"."
        )

    q_lower = question.lower()
    response_lines = []
    top_score = scores[0] if scores else 0.0

    if q_lower.strip() in {"hi", "hello", "hey", "yo"}:
        return (
            "Hi! I can help you find products, compare items, and suggest gifts. "
            "Try: \"gift under $50\" or \"cheaper than this\"."
        )

    if any(phrase in q_lower for phrase in ["what can you do", "what u can do", "what u cn do", "help", "how do you work", "what do you do"]):
        return (
            "I can help you find products, compare items, suggest gifts, and recommend budget-friendly picks. "
            "Try asking: \"gift under $50\", \"cheaper than this\", or \"best for travel\"."
        )

    if "laptop" in q_lower or "notebook" in q_lower or "macbook" in q_lower:
        return "We do not have laptops in the catalog yet. Here are the closest electronics picks I can suggest."

    if top_score < 0.32:
        picks = []
        for item in products[:3]:
            picks.append(f"{item.get('name', 'Item')} ({_format_money(item.get('price'))})")
        picks_text = ", ".join(picks)
        return f"I do not see a close match. Closest items: {picks_text}. Want a different budget or category?"

    if "difference" in q_lower and len(products) >= 2:
        first, second = products[0], products[1]
        response_lines.append(
            f"Here is a quick comparison between {first.get('name', 'Item 1')} and {second.get('name', 'Item 2')}:"
        )
        response_lines.append(
            f"- Price: {_format_money(first.get('price'))} vs {_format_money(second.get('price'))}"
        )
        response_lines.append(
            f"- Category: {first.get('category', 'N/A')} vs {second.get('category', 'N/A')}"
        )
        response_lines.append(
            f"- Stock: {first.get('stock', 0)} vs {second.get('stock', 0)}"
        )
        return "\n".join(response_lines)

    if "cheaper" in q_lower:
        cheapest = min(products, key=lambda p: p.get("price") or 0)
        return (
            f"The most budget-friendly option I found is {cheapest.get('name', 'this item')} "
            f"at {_format_money(cheapest.get('price'))}."
        )

    if "gift" in q_lower or "gifting" in q_lower:
        top = max(products, key=lambda p: p.get("rating") or 0)
        return (
            f"For gifting, {top.get('name', 'this item')} stands out with a rating of "
            f"{top.get('rating', 'N/A')}. It is a safe pick."
        )

    picks = []
    for item in products[:4]:
        picks.append(f"{item.get('name', 'Item')} ({_format_money(item.get('price'))})")
    picks_text = ", ".join(picks)
    return f"Here are good options from the catalog: {picks_text}. Want me to narrow it by budget, color, or use?"


def _ollama_available() -> bool:
    if AI_LLM_PROVIDER != "ollama":
        return False
    try:
        resp = requests.get(f"{AI_OLLAMA_URL}/api/tags", timeout=2)
        if not resp.ok:
            return False
        data = resp.json()
        models = [m.get("name") for m in data.get("models", [])]
        return AI_OLLAMA_MODEL in models
    except requests.RequestException:
        return False


def _openai_available() -> bool:
    return AI_LLM_PROVIDER == "openai" and bool(AI_OPENAI_API_KEY)


def _call_ollama(prompt: str, system: str | None = None) -> str:
    system_message = system or (
        "You are a helpful ecommerce shopping assistant. "
        "Answer only using the provided product list. "
        "If there is no good match, say so and suggest closest items."
    )
    payload = {
        "model": AI_OLLAMA_MODEL,
        "system": system_message,
        "prompt": prompt,
        "stream": False,
        "options": {
            "temperature": 0.2,
            "num_ctx": 512,
            "num_predict": 128,
            "num_batch": 8,
        },
        "keep_alive": "0s",
    }
    resp = requests.post(f"{AI_OLLAMA_URL}/api/generate", json=payload, timeout=30)
    resp.raise_for_status()
    data = resp.json()
    return data.get("response", "").strip()


def _call_openai(prompt: str) -> str:
    headers = {
        "Authorization": f"Bearer {AI_OPENAI_API_KEY}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": AI_OPENAI_MODEL,
        "messages": [
            {
                "role": "system",
                "content": (
                    "You are an ecommerce shopping assistant. Use ONLY the provided product list. "
                    "If the request is unclear, ask one short clarifying question. "
                    "When possible, mention 1-2 product names with prices. "
                    "Be friendly, concise, and end with a short question."
                ),
            },
            {"role": "user", "content": prompt},
        ],
        "temperature": 0.3,
        "max_tokens": 180,
    }
    resp = requests.post(
        "https://api.openai.com/v1/chat/completions",
        json=payload,
        headers=headers,
        timeout=30,
    )
    resp.raise_for_status()
    data = resp.json()
    choices = data.get("choices") or []
    if not choices:
        return ""
    return (choices[0].get("message", {}) or {}).get("content", "").strip()


def _build_chat_prompt(question, products) -> str:
    product_lines = []
    for idx, p in enumerate(products, start=1):
        product_lines.append(
            f"{idx}. {p.get('name','Unknown')} | ${p.get('price', 0):.2f} | "
            f"{p.get('category','N/A')} | rating {p.get('rating','N/A')} | stock {p.get('stock', 0)} | "
            f"highlights: {', '.join(p.get('highlights', [])[:3])}"
        )

    context = "\n".join(product_lines) if product_lines else "No products found."
    return (
        "You are an ecommerce shopping assistant. Use ONLY the provided product list. "
        "If the request is unclear, ask one short clarifying question. "
        "When possible, mention 1-2 product names with prices. "
        "Be friendly, concise, and end with a short question.\n\n"
        f"Customer question: {question}\n\n"
        f"Products:\n{context}\n\n"
        "Respond in 2-4 sentences."
    )


def _looks_like_refusal(answer: str) -> bool:
    lowered = answer.lower()
    refusal_phrases = [
        "can't assist",
        "cannot assist",
        "can't help",
        "cannot help",
        "i'm sorry, but",
        "i cannot",
        "i can't",
        "as an ai",
        "unable to",
    ]
    return any(phrase in lowered for phrase in refusal_phrases)


def _mentions_product(answer: str, products) -> bool:
    if not products:
        return True
    lowered = answer.lower()
    for product in products[:5]:
        name = str(product.get("name", "")).lower()
        if name and name in lowered:
            return True
    return False


def _looks_generic(answer: str) -> bool:
    lowered = answer.lower().strip()
    if len(lowered) < 25:
        return True
    generic_phrases = [
        "how can i help",
        "happy to help",
        "feel free to ask",
        "i can assist",
    ]
    return any(phrase in lowered for phrase in generic_phrases)

def _guess_category(name: str, fallback: str) -> str:
    name_lower = name.lower()
    if "shoe" in name_lower or "sneaker" in name_lower or "boot" in name_lower:
        return "Shoes"
    if "shirt" in name_lower or "hoodie" in name_lower or "jacket" in name_lower:
        return "Clothing"
    if "watch" in name_lower or "belt" in name_lower or "bag" in name_lower:
        return "Accessories"
    if "phone" in name_lower or "laptop" in name_lower or "headphone" in name_lower:
        return "Electronics"
    return fallback or "Other"


def _detect_colors(name: str) -> list:
    colors = []
    mapping = {
        "black": "#111827",
        "white": "#f8fafc",
        "red": "#ef4444",
        "blue": "#2563eb",
        "green": "#22c55e",
        "yellow": "#facc15",
        "orange": "#f97316",
        "pink": "#ec4899",
        "gray": "#9ca3af",
        "grey": "#9ca3af",
        "brown": "#a16207",
    }
    for key, value in mapping.items():
        if key in name.lower():
            colors.append(value)
    if not colors:
        colors = ["#111827", "#2563eb", "#e5e7eb"]
    return colors


def _format_price(price: str) -> str:
    try:
        return f"${float(price):.2f}"
    except (TypeError, ValueError):
        return "$0.00"


def _build_highlights(name: str, category: str) -> list:
    return [
        f"Premium {category.lower()} build",
        "Comfort-focused design",
        "Durable everyday materials",
        f"{name} ships fast",
    ]


def _build_faqs(name: str) -> list:
    return [
        f"Is {name} good for gifting? Yes, it is a popular gift choice.",
        "How long is shipping? Standard delivery is 3-5 business days.",
        "Can I return it? Returns are accepted within 30 days.",
    ]


def _build_tags(name: str, category: str) -> list:
    base = [category.lower(), "gift", "bestseller", "new"]
    name_tags = [word.lower() for word in name.split()[:2]]
    return list(dict.fromkeys(base + name_tags))


def _build_seo_title(name: str, category: str) -> str:
    return f"Buy {name} Online | {category} at E-Shop"


@app.post("/ai/generate")
def generate(req: GenerateRequest) -> dict:
    name = req.name.strip() or "This product"
    category = _guess_category(name, req.category.strip())
    description = (
        req.description.strip()
        or f"{name} is a modern {category.lower()} item designed for daily use. "
        f"It balances comfort, durability, and value."
    )
    highlights = _build_highlights(name, category)
    tags = _build_tags(name, category)
    seo_title = _build_seo_title(name, category)
    faqs = _build_faqs(name)
    colors = _detect_colors(name)

    if _ollama_available():
        prompt = (
            "Generate product content for this item. Return JSON only with keys: "
            "description (string), highlights (array), seoTitle (string), tags (array), "
            "faqs (array), colors (array of hex strings), category (string).\n\n"
            f"Name: {name}\nCategory: {category}\nPrice: {req.price}\n"
            f"Description: {req.description}\nHighlights: {req.highlights}\n"
        )
        try:
            raw = _call_ollama(prompt)
            data = json.loads(raw)
            return {
                "description": data.get("description", description),
                "highlights": data.get("highlights", highlights),
                "seoTitle": data.get("seoTitle", seo_title),
                "tags": data.get("tags", tags),
                "faqs": data.get("faqs", faqs),
                "colors": data.get("colors", colors),
                "category": data.get("category", category),
            }
        except Exception:
            pass

    return {
        "description": description,
        "highlights": highlights,
        "seoTitle": seo_title,
        "tags": tags,
        "faqs": faqs,
        "colors": colors,
        "category": category,
    }

def _build_general_prompt(question: str) -> str:
    return (
        "You are a helpful, concise assistant. "
        "Answer the user's question directly. "
        "If you are unsure, say so briefly.\n\n"
        f"User: {question}"
    )


def _build_general_system_prompt() -> str:
    return (
        "You are a helpful assistant. "
        "Answer the user's question directly and clearly. "
        "If you are unsure, say so briefly."
    )


@app.post("/ai/chat")
def chat(req: ChatRequest) -> dict:
    question = req.question.strip()
    if not question:
        return {"answer": "Ask me about products or pricing.", "products": []}

    if AI_CHAT_MODE == "general":
        answer = ""
        used_openai = False
        llm_error = ""
        try:
            prompt = _build_general_prompt(question)
            if _openai_available():
                answer = _call_openai(prompt)
                used_openai = True
            elif _ollama_available():
                answer = _call_ollama(prompt, system=_build_general_system_prompt())
        except requests.RequestException as exc:
            llm_error = str(exc)
            answer = ""

        if not answer:
            answer = "Assistant is unavailable."

        response = {"answer": answer, "products": []}
        if AI_DEBUG:
            response["llm_used"] = "openai" if used_openai else "ollama" if _ollama_available() else "none"
            response["llm_error"] = llm_error
            response["llm_model"] = AI_OPENAI_MODEL if used_openai else AI_OLLAMA_MODEL
        return response

    if _index is None or _model is None or _collection is None:
        raise HTTPException(status_code=503, detail="AI service not ready.")

    top_k = min(max(req.top_k, 1), len(_id_map))
    embedding = _model.encode([question], normalize_embeddings=True)
    embedding = np.asarray(embedding, dtype="float32")
    scores, indices = _index.search(embedding, top_k)

    pairs = []
    for score, idx in zip(scores[0], indices[0]):
        if idx < 0:
            continue
        pairs.append({"id": _id_map[idx], "score": float(score)})

    product_ids = [item["id"] for item in pairs]
    products = _load_products(product_ids)
    score_map = {item["id"]: item["score"] for item in pairs}
    scores_for_products = [score_map.get(str(p.get("_id")), 0.0) for p in products]

    answer = ""
    used_openai = False
    llm_error = ""
    if AI_CHAT_MODE != "catalog":
        try:
            prompt = _build_chat_prompt(question, products[:6])
            if _openai_available():
                answer = _call_openai(prompt)
                used_openai = True
            elif _ollama_available():
                answer = _call_ollama(prompt)
        except requests.RequestException as exc:
            llm_error = str(exc)
            answer = ""

    if (
        AI_CHAT_MODE == "catalog"
        or not answer
        or _looks_like_refusal(answer)
        or ((not used_openai) and _looks_generic(answer))
        or ((not used_openai) and not _mentions_product(answer, products))
    ):
        answer = _build_answer(question, products, scores_for_products)

    response = {
        "answer": answer,
        "products": [
            {
                "id": str(p.get("_id")),
                "name": p.get("name"),
                "price": p.get("price"),
                "category": p.get("category"),
                "image": p.get("image"),
            }
            for p in products
        ],
    }
    if AI_DEBUG:
        response["llm_used"] = "openai" if used_openai else "ollama" if _ollama_available() else "none"
        response["llm_error"] = llm_error
        response["llm_model"] = AI_OPENAI_MODEL if used_openai else AI_OLLAMA_MODEL
    return response
