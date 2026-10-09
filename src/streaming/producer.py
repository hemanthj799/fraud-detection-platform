
import os

import psycopg2
from dotenv import load_dotenv


load_dotenv()


DB_CONFIG = {
    "host": os.getenv("POSTGRES_HOST"),
    "port": int(os.getenv("POSTGRES_PORT", "5433")),
    "database": os.getenv("POSTGRES_DB"),
    "user": os.getenv("POSTGRES_USER"),
    "password": os.getenv("POSTGRES_PASSWORD"),
}


def get_connection():
    return psycopg2.connect(**DB_CONFIG)


def save_transaction(
    transaction,
    fraud_probability,
    risk_result,
    request_id=None,
):
    connection = get_connection()
    cursor = None

    try:
        cursor = connection.cursor()

        query = """
            INSERT INTO fraud_transactions (
                request_id,
                step,
                transaction_type,
                amount,
                old_balance_origin,
                old_balance_destination,
                fraud_probability,
                risk_level,
                decision
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
        """

        cursor.execute(
            query,
            (
                request_id or transaction.get("request_id"),
                transaction["step"],
                transaction["type"],
                transaction["amount"],
                transaction["oldbalanceOrg"],
                transaction["oldbalanceDest"],
                fraud_probability,
                risk_result["risk_level"],
                risk_result["decision"],
            ),
        )

        connection.commit()

    except Exception:
        connection.rollback()
        raise

    finally:
        if cursor is not None:
            cursor.close()
        connection.close()
