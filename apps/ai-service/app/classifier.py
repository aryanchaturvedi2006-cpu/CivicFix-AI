import re

from pydantic import BaseModel


MODEL_VERSION = "rule-engine-v1"

CATEGORY_KEYWORDS = {
    "GARBAGE": (
        "garbage", "trash", "waste", "rubbish", "dump", "litter",
        "cleaning", "stink", "smell", "bin",
    ),
    "ROAD_DAMAGE": (
        "road", "pothole", "potholes", "pavement", "footpath", "street",
        "crack", "broken road", "speed breaker", "asphalt",
    ),
    "STREETLIGHT": (
        "streetlight", "street light", "lamp", "light pole", "electric",
        "bulb", "dark", "lighting",
    ),
    "WATER_LEAKAGE": (
        "water", "pipeline", "pipe", "leak", "sewage", "tap",
        "overflow", "burst", "flood",
    ),
    "DRAINAGE": (
        "drain", "drainage", "clog", "blocked", "blockage", "manhole",
        "sewer", "canal", "gutter",
    ),
}

DEPARTMENT_BY_CATEGORY = {
    "GARBAGE": "SANITATION",
    "ROAD_DAMAGE": "ROADS",
    "STREETLIGHT": "ELECTRICAL",
    "WATER_LEAKAGE": "WATER_DRAIN",
    "DRAINAGE": "WATER_DRAIN",
    "OTHER": "ROADS",
}

CRITICAL_KEYWORDS = (
    "accident", "electrocution", "explosion", "open wire", "collapsed",
    "major burst", "deep pothole",
)
HIGH_KEYWORDS = (
    "urgent", "danger", "dangerous", "injury", "fire", "flood",
    "overflow", "blocked", "burst", "exposed",
)
MEDIUM_KEYWORDS = (
    "broken", "damage", "damaged", "leak", "leakage", "not working",
)


class ClassificationResult(BaseModel):
    category: str
    severity: str
    confidence: float
    departmentCode: str
    keywords: list[str]
    duplicateScore: float
    modelVersion: str


def classify_complaint(title: str, description: str, image_url: str | None = None) -> ClassificationResult:
    text = f"{title} {description}".lower()
    words = re.findall(r"[a-z]+", text)

    scores: dict[str, int] = {category: 0 for category in CATEGORY_KEYWORDS}
    matched_keywords: list[str] = []

    for category, keywords in CATEGORY_KEYWORDS.items():
        for keyword in keywords:
            if keyword in text:
                scores[category] += 2 if " " in keyword else 1
                matched_keywords.append(keyword)

    category = max(scores, key=scores.get)
    category_score = scores[category]
    if category_score == 0:
        category = "OTHER"
        confidence = 0.35
    else:
        ranked = sorted(scores.values(), reverse=True)
        margin = ranked[0] - ranked[1] if len(ranked) > 1 else ranked[0]
        confidence = min(0.98, 0.55 + category_score * 0.08 + margin * 0.03)

    if any(keyword in text for keyword in CRITICAL_KEYWORDS):
        severity = "CRITICAL"
    elif any(keyword in text for keyword in HIGH_KEYWORDS):
        severity = "HIGH"
    elif any(keyword in text for keyword in MEDIUM_KEYWORDS):
        severity = "MEDIUM"
    else:
        severity = "LOW"

    duplicate_score = 0.0
    if image_url:
        duplicate_score = 0.15

    unique_keywords = list(dict.fromkeys(matched_keywords))[:20]
    return ClassificationResult(
        category=category,
        severity=severity,
        confidence=round(confidence, 3),
        departmentCode=DEPARTMENT_BY_CATEGORY[category],
        keywords=unique_keywords,
        duplicateScore=duplicate_score,
        modelVersion=MODEL_VERSION,
    )
