from app.classifier import classify_complaint
from app.main import app
from fastapi.testclient import TestClient


def test_pothole_classification():
    result = classify_complaint(
        title="Dangerous pothole",
        description="A deep pothole is damaged on the main road",
    )
    assert result.category == "ROAD_DAMAGE"
    assert result.severity in {"HIGH", "CRITICAL"}
    assert result.departmentCode == "ROADS"


def test_health_endpoint():
    client = TestClient(app)
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"
