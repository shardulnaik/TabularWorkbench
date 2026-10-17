def test_bar_chart_with_x_and_y_columns(client):
    rows = ["RollNo,Marks"] + [f"{i},{40 + (i * 3) % 60}" for i in range(1, 13)]
    response = client.post("/api/v1/datasets/upload", files={"file": ("marks.csv", "\n".join(rows).encode(), "text/csv")})
    assert response.status_code == 200, response.text
    dataset_id = response.json()["session_id"]
    chart = client.post(f"/api/v1/datasets/{dataset_id}/charts/data", json={"chart_type": "bar", "x_column": "RollNo", "y_column": "Marks", "aggregation": "mean"})
    assert chart.status_code == 200, chart.text
    assert chart.json()["chart_type"] == "bar"
    assert len(chart.json()["data"]) == 12
    download = client.get(f"/api/v1/datasets/{dataset_id}/exports/chart-data", params={"chart_run_id": chart.json()["chart_run_id"]})
    assert download.status_code == 200


def test_histogram_rejects_categorical_column(client):
    csv = b"Dept,Score\nSales,10\nResearch,12\nSales,14\nResearch,13\n"
    result = client.post("/api/v1/datasets/upload", files={"file": ("data.csv", csv, "text/csv")})
    dataset_id = result.json()["session_id"]
    chart = client.post(f"/api/v1/datasets/{dataset_id}/charts/data", json={"chart_type": "histogram", "x_column": "Dept"})
    assert chart.status_code == 422
