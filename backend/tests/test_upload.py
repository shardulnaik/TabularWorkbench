def test_upload_csv_and_profile(client):
    csv = b"Age,Department,Attrition\n25,Sales,Yes\n42,Research,No\n31,Sales,No\n"
    response = client.post("/api/v1/datasets/upload", files={"file": ("people.csv", csv, "text/csv")})
    assert response.status_code == 200, response.text
    payload = response.json()
    assert payload["requires_sheet_selection"] is False
    assert payload["row_count"] == 3
    assert payload["column_count"] == 3
    dataset_id = payload["session_id"]
    profile_response = client.get(f"/api/v1/datasets/{dataset_id}/profile")
    assert profile_response.status_code == 200
    assert profile_response.json()["profile"]["row_count"] == 3


def test_rejects_unsupported_file_type(client):
    response = client.post("/api/v1/datasets/upload", files={"file": ("script.exe", b"nope", "application/octet-stream")})
    assert response.status_code == 415


def test_rejects_empty_file(client):
    response = client.post("/api/v1/datasets/upload", files={"file": ("empty.csv", b"", "text/csv")})
    assert response.status_code == 400
