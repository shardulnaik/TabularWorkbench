import pandas as pd
from app.services.profiling_service import profile_dataframe


def test_profile_reports_missing_and_duplicates():
    df = pd.DataFrame({"score": [10, None, 10], "department": [" Sales ", "Sales", " Sales "]})
    profile = profile_dataframe(df)
    assert profile["row_count"] == 3
    assert profile["missing_cells"] == 1
    assert profile["duplicate_rows"] == 1
    assert any(column["name"] == "score" and column["kind"] == "numeric" for column in profile["columns"])
