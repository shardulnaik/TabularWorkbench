def test_compare_and_evaluate_selected_model(client):
    rows = ["EmployeeID,Age,Department,OverTime,Attrition"]
    departments = ["Sales", "Research", "Operations"]
    for i in range(1, 61):
        attrition = "Yes" if i % 2 == 0 else "No"
        overtime = "Yes" if i % 3 != 0 else "No"
        rows.append(f"E{i:03d},{22 + (i % 28)},{departments[i % 3]},{overtime},{attrition}")
    upload = client.post("/api/v1/datasets/upload", files={"file": ("attrition.csv", "\n".join(rows).encode(), "text/csv")})
    assert upload.status_code == 200, upload.text
    dataset_id = upload.json()["session_id"]
    compared = client.post(f"/api/v1/datasets/{dataset_id}/ml/compare", json={"target_column": "Attrition", "scoring_metric": "accuracy"})
    assert compared.status_code == 200, compared.text
    payload = compared.json()
    assert len(payload["models"]) == 3
    assert payload["recommended_model"] in {"logistic_regression", "random_forest", "knn_classifier"}
    selected = payload["recommended_model"]
    evaluated = client.post(f"/api/v1/datasets/{dataset_id}/ml/evaluate", json={"model_run_id": payload["model_run_id"], "selected_model": selected})
    assert evaluated.status_code == 200, evaluated.text
    result = evaluated.json()
    assert "accuracy" in result["metrics"]
    assert result["confusion_matrix"]["matrix"]
    assert result["artifact_available"] is True
    download = client.get(f"/api/v1/datasets/{dataset_id}/exports/model-metrics", params={"run_id": payload["model_run_id"]})
    assert download.status_code == 200


def test_regression_and_target_free_kmeans(client):
    rows = ["RecordID,Salary,Age,Department,Constant"]
    depts = ["Sales", "Research", "Operations"]
    for i in range(1, 81):
        rows.append(f"{i},{25000 + i * 830},{20 + i % 35},{depts[i % 3]},same")
    upload = client.post("/api/v1/datasets/upload", files={"file": ("work.csv", "\n".join(rows).encode(), "text/csv")})
    assert upload.status_code == 200, upload.text
    dataset_id = upload.json()["session_id"]
    profile = upload.json()["profile"]
    salary = next(c for c in profile["columns"] if c["name"] == "Salary")
    assert salary["target_eligibility"]["regression"]["applicable"] is True
    assert salary["target_eligibility"]["classification"]["applicable"] is False
    compare = client.post(f"/api/v1/datasets/{dataset_id}/ml/compare", json={"target_column": "Salary", "task_type": "regression", "scoring_metric": "mae"})
    assert compare.status_code == 200, compare.text
    assert compare.json()["models"][0]["model"] == "linear_regression"
    result = client.post(f"/api/v1/datasets/{dataset_id}/ml/evaluate", json={"model_run_id": compare.json()["model_run_id"], "selected_model": "linear_regression"})
    assert result.status_code == 200, result.text
    assert {"mae", "mse", "rmse", "r2"}.issubset(result.json()["metrics"])
    clustered = client.post(f"/api/v1/datasets/{dataset_id}/ml/cluster", json={"feature_columns": ["Age", "Department"], "n_clusters": 3})
    assert clustered.status_code == 200, clustered.text
    assert {"silhouette_score", "davies_bouldin_index", "calinski_harabasz_score"}.issubset(clustered.json()["metrics"])
