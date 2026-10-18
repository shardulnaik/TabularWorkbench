import { ArrowLeft, ArrowRight, Layers3 } from 'lucide-react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
export function AppShell() {
    const location = useLocation();
    const navigate = useNavigate();
    const match = location.pathname.match(/^\/datasets\/([^/]+)/);
    const datasetId = match?.[1];
    const stages = datasetId ? [
        `/datasets/${datasetId}`,
        `/datasets/${datasetId}/predict`,
        `/datasets/${datasetId}/results`,
    ] : [];
    const currentStage = stages.indexOf(location.pathname);
    const isChartsPage = location.pathname === `/datasets/${datasetId}/explore`;
    const visitedKey = `tabular-visited:${datasetId}`;
    const visited = datasetId ? JSON.parse(sessionStorage.getItem(visitedKey) || '[]') : [];
    if (datasetId && currentStage >= 0 && !visited.includes(location.pathname)) {
        visited.push(location.pathname);
        sessionStorage.setItem(visitedKey, JSON.stringify(visited));
    }
    const canGoBack = isChartsPage || currentStage > 0;
    const canGoForward = currentStage >= 0 && currentStage < stages.length - 1 && visited.includes(stages[currentStage + 1]);
    return (<div className="app-root">
      <header className="topbar">
        <Link className="brand" to="/" aria-label="Tabular Workbench home">
          <span className="brand-mark"><Layers3 size={20}/></span>
          <span className="brand-copy"><strong>Tabular</strong><span>WORKBENCH</span></span>
        </Link>
      </header>

      {datasetId && (currentStage >= 0 || isChartsPage) && (<nav className="workflow-nav workflow-arrows" aria-label="Page history">
          <button type="button" className="history-arrow" aria-label="Previous page" disabled={!canGoBack} onClick={() => navigate(isChartsPage ? stages[1] : stages[currentStage - 1])}><ArrowLeft size={19}/></button>
          {!isChartsPage && <button type="button" className="history-arrow" aria-label="Next page" disabled={!canGoForward} onClick={() => navigate(stages[currentStage + 1])}><ArrowRight size={19}/></button>}
        </nav>)}

        <main className="page-container"><Outlet /></main>
    </div>);
}
