def test_cleaning_logs_changes_and_preserves_original(client):
    csv = b"Name,Score\n Alice ,10\nBob,9\nBob,9\n ,7\n"
    response = client.post("/api/v1/datasets/upload", files={"file": ("students.csv", csv, "text/csv")})
    assert response.status_code == 200, response.text
    dataset_id = response.json()["session_id"]
    response = client.post(f"/api/v1/datasets/{dataset_id}/cleaning/apply", json={"actions": ["trim_whitespace", "normalize_blank_strings", "remove_duplicates"]})
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["profile"]["row_count"] == 3
    assert len(body["cleaning_log"]) == 3
    log = client.get(f"/api/v1/datasets/{dataset_id}/cleaning/log")
    assert log.status_code == 200
    assert len(log.json()["items"]) == 3
    cleaned = client.get(f"/api/v1/datasets/{dataset_id}/exports/cleaned-data")
    assert cleaned.status_code == 200
    assert b"Alice" in cleaned.content
