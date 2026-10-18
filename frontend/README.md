# Frontend

The frontend is a JavaScript React application built with Vite.

## Development

From this directory, install the dependencies and start the local development server:

```powershell
npm install
Copy-Item .env.example .env.local
npm run dev
```

Set `VITE_API_URL` in `.env.local` to the backend origin (for example, `http://127.0.0.1:8000`). The frontend appends `/api/v1` when making API requests.

## Checks

```powershell
npm test
npm run build
npm run lint
```
