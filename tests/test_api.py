from fastapi.testclient import TestClient

from api.main import app


client = TestClient(app)


def test_root():
    response = client.get("/")

    assert response.status_code == 200
    assert response.json()["status"] == "running"


def test_valid_transaction():
    response = client.post(
        "/predict",
        json={
            "step": 100,
            "amount": 5000,
            "oldbalanceOrg": 10000,
            "oldbalanceDest": 2000,
            "type": "TRANSFER"
        }
    )

    assert response.status_code == 200

    data = response.json()

    assert "fraud_probability" in data
    assert "risk_level" in data
    assert "decision" in data

    assert 0 <= data["fraud_probability"] <= 1

    assert data["risk_level"] in [
        "LOW",
        "MEDIUM",
        "HIGH"
    ]

    assert data["decision"] in [
        "APPROVE",
        "REVIEW",
        "BLOCK"
    ]


def test_invalid_transaction_type():
    response = client.post(
        "/predict",
        json={
            "step": 100,
            "amount": 5000,
            "oldbalanceOrg": 10000,
            "oldbalanceDest": 2000,
            "type": "HELLO"
        }
    )

    assert response.status_code == 422


def test_negative_amount_is_rejected():
    response = client.post("/predict", json={
        "step": 100,
        "amount": -5000,
        "oldbalanceOrg": 10000,
        "oldbalanceDest": 2000,
        "type": "TRANSFER"
    })

    assert response.status_code == 422


def test_negative_balance_is_rejected():
    response = client.post("/predict", json={
        "step": 100,
        "amount": 5000,
        "oldbalanceOrg": -10000,
        "oldbalanceDest": 2000,
        "type": "TRANSFER"
    })

    assert response.status_code == 422
    