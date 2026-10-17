def test_profile_and_zip_exports(client):
    csv = b"Age,Score\n20,75\n21,80\n22,82\n"
    uploaded = client.post("/api/v1/datasets/upload", files={"file": ("scores.csv", csv, "text/csv")})
    assert uploaded.status_code == 200
    dataset_id = uploaded.json()["session_id"]
    profile = client.get(f"/api/v1/datasets/{dataset_id}/exports/data-profile")
    assert profile.status_code == 200
    assert profile.headers["content-type"].startswith("application/json")
    package = client.get(f"/api/v1/datasets/{dataset_id}/exports/all.zip")
    assert package.status_code == 200
    assert package.headers["content-type"].startswith("application/zip")
    assert len(package.content) > 50
