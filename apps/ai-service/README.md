# CivicFix AI Service

FastAPI microservice that provides deterministic complaint category and severity inference.

## Run

```bash
cd apps/ai-service
python -m venv .venv
.venv/Scripts/pip install -r requirements.txt
.venv/Scripts/uvicorn app.main:app --reload --port 8000
```

## API

- `GET /health`
- `POST /api/v1/classify`

Example:

```json
{
  "title": "Large pothole near my street",
  "description": "A dangerous pothole is blocking the road",
  "latitude": 28.6139,
  "longitude": 77.2090,
  "imageUrl": "https://example.com/pothole.jpg"
}
```
