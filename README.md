# Tabular Data Analysis & ML Workbench

A guided, full-stack application for tabular data profiling, conservative cleaning, exploratory charts, classification model comparison, held-out evaluation, and exportable results.

## Product workflow

1. Upload a CSV or XLSX file (20 MB upload limit; up to 500,000 rows, 500 columns, and 2 million total cells).
2. Review dataset health and the initial data preview.
3. Choose and apply cleaning operations; the original upload and original parsed dataframe remain separate.
4. Explore statistics and create schema-aware histograms, bar charts, line charts, scatter plots, and correlation heatmaps.
5. Optionally compare Dummy Classifier, Logistic Regression, and Random Forest using cross-validation on the training partition.
6. Select a candidate and evaluate it on the held-out test partition.
7. Download individual outputs or a ZIP containing the original upload, current data profile, cleaned CSV, cleaning log, charts, model results and artifacts when available.

The initial ML release supports classification. Regression, persisted project history, scoring brand-new datasets with a trained pipeline, and PDF reports are outside this version's scope.

## Technology

- Frontend: React, TypeScript, Vite, React Router, Recharts
- Backend: FastAPI, Pydantic Settings, Pandas, NumPy
- Database: MySQL via SQLAlchemy and PyMySQL; SQLite is used only by automated tests
- ML: Scikit-learn Pipelines, ColumnTransformer, cross-validation, and held-out evaluation
- Testing: pytest, Vitest, Testing Library
- Packaging and hosting: Docker, Render, Vercel

## Before starting

- Python 3.14 is recommended to match the included Dockerfile.
- Node.js 24 is suitable for the included Vite configuration.
- A local MySQL Server is required for ordinary local development; `backend/.env` must contain a valid database URL.
- Docker Desktop is needed for local container verification.

## Local setup

### 1. Backend environment

From the repository root (PowerShell):

```powershell
py -3.14 -m venv .venv
.\.venv\Scripts\python.exe -m pip install --upgrade pip
.\.venv\Scripts\python.exe -m pip install -r backend\requirements-dev.txt
if (-not (Test-Path backend\.env)) { Copy-Item backend\.env.example backend\.env }
```

Edit `backend/.env`. Set a database URL for your local MySQL server and keep the password out of source control. URL-encode special characters in the password when necessary. Do not commit `.env` files.

### 2. Frontend dependencies

```powershell
cd frontend
npm install
if (-not (Test-Path .env.local)) { Copy-Item .env.example .env.local }
cd ..
```

`frontend/.env.local` should contain `VITE_API_BASE_URL=http://127.0.0.1:8000/api/v1` for local development.

### 3. Start the backend

```powershell
cd backend
..\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Open `http://127.0.0.1:8000/docs` for interactive API documentation. `GET /health` is a liveness endpoint. `GET /health/ready` checks database connectivity.

### 4. Start the frontend

In a second PowerShell terminal:

```powershell
cd frontend
npm run dev
```

Open the URL Vite prints (normally `http://127.0.0.1:5173`). Use **Try a sample dataset** to exercise the workflow without preparing a CSV yourself.

## Tests and static checks

Run backend tests from the repository root. Tests set their own SQLite database and temporary artifact directory; they do not write to your local MySQL database.

```powershell
.\.venv\Scripts\python.exe -m pytest backend\tests -q
```

Run frontend tests and production build:

```powershell
cd frontend
npm test
npm run build
cd ..
```

Run `pip check` and `npm list --depth=0` as dependency sanity checks. A green dependency check does not prove that runtime services are reachable; test the local MySQL server and complete upload-to-export workflow before deployment.

## API endpoints

- `GET /health` and `GET /health/ready`
- `POST /api/v1/datasets/upload`
- `GET /api/v1/datasets/{dataset_id}`
- `GET /api/v1/datasets/{dataset_id}/profile`
- `GET /api/v1/datasets/{dataset_id}/cleaning/plan`
- `POST /api/v1/datasets/{dataset_id}/cleaning/apply`
- `GET /api/v1/datasets/{dataset_id}/cleaning/log`
- `GET /api/v1/datasets/{dataset_id}/eda/summary`
- `POST /api/v1/datasets/{dataset_id}/charts/data`
- `POST /api/v1/datasets/{dataset_id}/ml/compare`
- `POST /api/v1/datasets/{dataset_id}/ml/evaluate`
- `GET /api/v1/datasets/{dataset_id}/ml/runs/{run_id}`
- `GET /api/v1/datasets/{dataset_id}/exports/{export_type}` (includes `original-upload`, `cleaned-data`, `data-profile`, `cleaning-log`, chart/model artifacts, and `all.zip`)

## Data and ML limitations

- Temporary dataset/model artifacts are stored locally under `backend/runtime` by default. They can be lost during a redeploy or restart on hosts with ephemeral filesystems. Use a persistent disk or object storage if durable artifacts are required.
- Anonymous session IDs are random UUIDs and expire after the configured TTL. They are not a substitute for user authentication or authorization in a multi-user production product.
- Excel upload supports `.xlsx`; CSV and XLSX input is capped by size and row/column limits.
- Exact duplicate rows may be legitimate repeated observations; removal is an explicit user choice.
- General-purpose imputation is optional and can be inappropriate for a prediction target. The ML engine excludes rows with missing target labels and fits preprocessing only inside the model pipeline.
- ID-like, constant and empty columns are excluded from ML features by default. Date/time columns are converted into basic calendar parts when recognized. Inspect the exclusions before interpreting the model.
- Model comparison uses training-set cross-validation. The selected model's final report is computed on a held-out test split. Selecting by one metric does not make the model universally best.
- Feature signals reflect the fitted model's use of features; they do not prove causality.
- A downloaded `.joblib` pipeline should only be loaded from a source you trust. Never load arbitrary user-supplied serialized model files.
- CSV exports prefix formula-like text cells to reduce spreadsheet formula-injection risk. That may alter the exported representation of those particular text cells; the in-app data is unchanged.
- Uploaded employee, student, or customer information should be synthetic or properly authorized. Avoid processing sensitive personal data in a public demo.

## Deployment outline

### Backend on Render

- Push the repository to GitHub.
- Create a Render Web Service using the `backend/` root directory and Docker environment.
- Configure `DATABASE_URL`, `CORS_ORIGINS`, `ARTIFACT_STORAGE_DIR`, `MAX_UPLOAD_MB`, and `SESSION_TTL_HOURS` as Render environment variables.
- Provide MySQL using a managed/private MySQL service or a separately provisioned persistent deployment. The local Workbench database does not become internet-accessible just because the API is deployed.
- Configure persistent storage for `ARTIFACT_STORAGE_DIR` if artifacts must survive restart/redeploy.
- Set `CORS_ORIGINS` to your deployed Vercel origin, without a trailing slash.

### Frontend on Vercel

- Import the repository.
- Set the root directory to `frontend`.
- Set `VITE_API_BASE_URL` to `https://YOUR-RENDER-SERVICE.onrender.com/api/v1`.
- Deploy and verify that the Render CORS allowlist includes the exact frontend origin.

There is no GitHub Actions workflow in this project. Tests are run locally; Vercel's native Git deployment integration is independent of GitHub Actions.
