
import logging
import time
import uuid

import joblib
import numpy as np
import pandas as pd

from fastapi import FastAPI, HTTPException, Request
from pydantic import BaseModel, Field
from typing import Literal
from fastapi.middleware.cors import CORSMiddleware


from configs.model_features import MODEL_FEATURES
from src.inference.risk_engine import build_risk_result


# --------------------------------------------------
# 1. Logging configuration
# --------------------------------------------------

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
)

logger = logging.getLogger(__name__)


# --------------------------------------------------
# 2. Load model and preprocessor
# --------------------------------------------------

model = joblib.load("models/random_forest_fraud_model.joblib")
preprocessor = joblib.load("models/preprocessor.joblib")


# --------------------------------------------------
# 3. Initialize FastAPI
# --------------------------------------------------

app = FastAPI(
    title="Real-Time Fraud Detection API",
    description="API for fraud prediction and transaction risk scoring.",
    version="1.0.0",
)


app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://fraudguard-dashboard-zeta.vercel.app",
    ],
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)

# --------------------------------------------------
# 4. Request tracking middleware
# --------------------------------------------------

@app.middleware("http")
async def request_tracking_middleware(
    request: Request,
    call_next,
):
    request_id = str(uuid.uuid4())
    start_time = time.perf_counter()

    try:
        response = await call_next(request)
    except Exception:
        logger.exception(
            "Unhandled request error | request_id=%s | path=%s",
            request_id,
            request.url.path,
        )
        raise

    duration_ms = (time.perf_counter() - start_time) * 1000

    response.headers["X-Request-ID"] = request_id

    logger.info(
        "HTTP request completed | request_id=%s | "
        "method=%s | path=%s | status=%s | duration_ms=%.2f",
        request_id,
        request.method,
        request.url.path,
        response.status_code,
        duration_ms,
    )

    return response


# --------------------------------------------------
# 5. Transaction request schema and validation
# --------------------------------------------------

class TransactionRequest(BaseModel):
    step: int = Field(
        ...,
        ge=0,
        description="Transaction time step",
    )

    amount: float = Field(
        ...,
        ge=0,
        description="Transaction amount",
    )

    oldbalanceOrg: float = Field(
        ...,
        ge=0,
        description="Origin account balance before transaction",
    )

    oldbalanceDest: float = Field(
        ...,
        ge=0,
        description="Destination account balance before transaction",
    )

    type: Literal[
        "CASH_IN",
        "CASH_OUT",
        "DEBIT",
        "PAYMENT",
        "TRANSFER",
    ]


# --------------------------------------------------
# 6. Root health endpoint
# --------------------------------------------------

@app.get("/")
def root():
    return {
        "service": "Real-Time Fraud Detection API",
        "status": "running",
    }


# --------------------------------------------------
# 7. Fraud prediction endpoint
# --------------------------------------------------

@app.post("/predict")
def predict(
    transaction: TransactionRequest,
    request: Request,
):
    request_id = request.headers.get(
        "X-Request-ID",
        "not-provided",
    )

    try:
        amount = transaction.amount
        oldbalance_org = transaction.oldbalanceOrg
        oldbalance_dest = transaction.oldbalanceDest
        step = transaction.step

        # Build the features expected by the trained model.
        features = {
            "step": step,
            "type": transaction.type,
            "amount": amount,
            "oldbalanceOrg": oldbalance_org,
            "oldbalanceDest": oldbalance_dest,

            "amount_log": np.log1p(amount),

            "amount_to_origin_balance": (
                amount / oldbalance_org
                if oldbalance_org > 0
                else 0
            ),

            "amount_to_dest_balance": (
                amount / oldbalance_dest
                if oldbalance_dest > 0
                else 0
            ),

            "origin_balance_depletion": int(
                amount >= oldbalance_org
            ),

            "origin_balance_zero": int(
                oldbalance_org == 0
            ),

            "destination_balance_zero": int(
                oldbalance_dest == 0
            ),

            "hour": step % 24,
            "day": step // 24,

            "hour_sin": np.sin(
                2 * np.pi * (step % 24) / 24
            ),

            "hour_cos": np.cos(
                2 * np.pi * (step % 24) / 24
            ),
        }

        # Keep the feature order consistent with model training.
        input_df = pd.DataFrame(
            [features],
            columns=MODEL_FEATURES,
        )

        # Apply the saved preprocessing pipeline.
        processed_input = preprocessor.transform(input_df)

        # Get the predicted fraud probability.
        fraud_probability = float(
            model.predict_proba(processed_input)[0, 1]
        )

        # Convert probability into a risk level and decision.
        risk_result = build_risk_result(
            fraud_probability=fraud_probability
        )

        logger.info(
            "Prediction completed | request_id=%s | "
            "risk_level=%s | decision=%s",
            request_id,
            risk_result["risk_level"],
            risk_result["decision"],
        )

        return {
            "request_id": request_id,
            "transaction": transaction.model_dump(),
            **risk_result,
        }

    except HTTPException:
        raise

    except Exception:
        logger.exception(
            "Fraud prediction failed | request_id=%s",
            request_id,
        )

        raise HTTPException(
            status_code=500,
            detail="Prediction failed due to an internal server error.",
        )
