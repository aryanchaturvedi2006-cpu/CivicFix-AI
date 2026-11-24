from fastapi import FastAPI
from pydantic import BaseModel, Field

from app.classifier import ClassificationResult, classify_complaint


app = FastAPI(
    title="CivicFix AI Service",
    description="Text-based complaint classification and severity assessment",
    version="1.0.0",
)


class ClassificationRequest(BaseModel):
    title: str = Field(min_length=5, max_length=160)
    description: str = Field(min_length=10, max_length=5000)
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    image_url: str | None = Field(default=None, alias="imageUrl")

    model_config = {"populate_by_name": True}


@app.get("/health")
async def health():
    return {
        "status": "healthy",
        "service": "civicfix-ai",
        "modelVersion": "rule-engine-v1",
    }


@app.post("/api/v1/classify", response_model=ClassificationResult)
async def classify(request: ClassificationRequest):
    return classify_complaint(
        title=request.title,
        description=request.description,
        image_url=request.image_url,
    )
