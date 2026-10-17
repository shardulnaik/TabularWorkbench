from sqlalchemy import inspect
from app.db.session import engine


def test_expected_tables_exist(client):
    tables = set(inspect(engine).get_table_names())
    assert {"dataset_sessions", "cleaning_logs", "chart_runs", "model_runs"}.issubset(tables)
