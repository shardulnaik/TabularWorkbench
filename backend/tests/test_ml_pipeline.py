def upload_employee_data(client):
    rows = ["EmployeeID,Age,Salary,Experience,Department,Attrition"]
    departments = ["IT", "HR", "Sales"]
    for i in range(1, 101):
        age = 20 + (i % 31)
        experience = i % 12
        salary = 24000 + i * 725
        department = departments[i % len(departments)]
        attrition = "Yes" if (i + experience) % 3 == 0 else "No"
        rows.append(f"E{i:04d},{age},{salary},{experience},{department},{attrition}")
    uploaded = client.post("/api/v1/datasets/upload", files={"file": ("employees.csv", "\n".join(rows).encode(), "text/csv")})
    assert uploaded.status_code == 200, uploaded.text
    return uploaded.json()["session_id"], uploaded.json()["profile"]


def test_classification_trains_and_predicts_one_record(client):
    dataset_id, profile = upload_employee_data(client)
    attrition = next(column for column in profile["columns"] if column["name"] == "Attrition")
    assert attrition["target_eligibility"]["classification"]["applicable"] is True

    trained = client.post(f"/api/v1/datasets/{dataset_id}/ml/train", json={"target_column": "Attrition"})
    assert trained.status_code == 200, trained.text
    model = trained.json()
    assert model["task_type"] == "classification"
    assert model["model"] == "random_forest_classifier"
    assert {"accuracy", "precision_weighted", "recall_weighted", "f1_weighted"}.issubset(model["metrics"])
    names = {feature["name"] for feature in model["feature_schema"]}
    assert names == {"Age", "Salary", "Experience", "Department"}
    assert "EmployeeID" not in names and "Attrition" not in names

    predicted = client.post(f"/api/v1/datasets/{dataset_id}/ml/predict", json={
        "model_run_id": model["model_run_id"],
        "inputs": {"Age": 28, "Salary": 65000, "Experience": 5, "Department": "Legal"},
    })
    assert predicted.status_code == 200, predicted.text
    result = predicted.json()
    assert result["task_type"] == "classification"
    assert result["predicted_value"] in {"Yes", "No"}
    assert abs(sum(result["probabilities"].values()) - 1) < 1e-6
    assert any("Unseen category in Department" in warning for warning in result["warnings"])

    resumed = client.get(f"/api/v1/datasets/{dataset_id}/ml/runs/{model['model_run_id']}")
    assert resumed.status_code == 200
    assert resumed.json()["artifact_available"] is True


def test_regression_trains_and_predicts_one_record(client):
    dataset_id, profile = upload_employee_data(client)
    salary = next(column for column in profile["columns"] if column["name"] == "Salary")
    assert salary["target_eligibility"]["regression"]["applicable"] is True
    assert salary["target_eligibility"]["classification"]["applicable"] is False

    trained = client.post(f"/api/v1/datasets/{dataset_id}/ml/train", json={"target_column": "Salary"})
    assert trained.status_code == 200, trained.text
    model = trained.json()
    assert model["task_type"] == "regression"
    assert model["model"] == "random_forest_regressor"
    assert {"mae", "mse", "rmse", "r2"}.issubset(model["metrics"])

    predicted = client.post(f"/api/v1/datasets/{dataset_id}/ml/predict", json={
        "model_run_id": model["model_run_id"],
        "inputs": {"Age": 28, "Experience": 5, "Department": "IT", "Attrition": "No"},
    })
    assert predicted.status_code == 200, predicted.text
    assert predicted.json()["task_type"] == "regression"
    assert isinstance(predicted.json()["predicted_value"], float)
    assert predicted.json()["probabilities"] is None


def test_unsuitable_targets_and_invalid_prediction_inputs_are_rejected(client):
    dataset_id, _ = upload_employee_data(client)
    invalid_target = client.post(f"/api/v1/datasets/{dataset_id}/ml/train", json={"target_column": "EmployeeID"})
    assert invalid_target.status_code == 422

    trained = client.post(f"/api/v1/datasets/{dataset_id}/ml/train", json={"target_column": "Attrition"})
    assert trained.status_code == 200, trained.text
    model = trained.json()
    invalid_input = client.post(f"/api/v1/datasets/{dataset_id}/ml/predict", json={
        "model_run_id": model["model_run_id"],
        "inputs": {"Age": "old", "Salary": 65000, "Experience": 5, "Department": "IT"},
    })
    assert invalid_input.status_code == 422


def test_classification_with_unrepresented_rare_class_fails_clearly(client):
    rows = ["Age,Outcome"]
    rows.extend(f"{20 + i},{'rare' if i == 0 else 'common'}" for i in range(30))
    uploaded = client.post("/api/v1/datasets/upload", files={"file": ("rare.csv", "\n".join(rows).encode(), "text/csv")})
    dataset_id = uploaded.json()["session_id"]
    response = client.post(f"/api/v1/datasets/{dataset_id}/ml/train", json={"target_column": "Outcome"})
    assert response.status_code == 422
    assert "at least two labeled rows" in response.json()["detail"]
