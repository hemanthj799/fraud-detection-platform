import numpy as np
import pandas as pd
import joblib

from configs.model_features import MODEL_FEATURES


model = joblib.load(
    "models/random_forest_fraud_model.joblib"
)

preprocessor = joblib.load(
    "models/preprocessor.joblib"
)


def predict_fraud(transaction: dict) -> float:

    step = transaction["step"]
    amount = transaction["amount"]
    oldbalance_org = transaction["oldbalanceOrg"]
    oldbalance_dest = transaction["oldbalanceDest"]
    transaction_type = transaction["type"]

    features = {
        "step": step,
        "type": transaction_type,
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
        )
    }

    input_df = pd.DataFrame(
        [features],
        columns=MODEL_FEATURES
    )

    processed_input = preprocessor.transform(
        input_df
    )

    fraud_probability = model.predict_proba(
        processed_input
    )[0, 1]

    return float(fraud_probability)