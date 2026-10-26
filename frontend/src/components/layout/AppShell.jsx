import { ArrowLeft, ArrowRight, Layers3, Moon, Sun } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
export function AppShell() {
    const location = useLocation();
    const navigate = useNavigate();
    const [theme, setTheme] = useState(() => window.localStorage.getItem('tabular-theme') || 'light');
    useEffect(() => {
        document.documentElement.dataset.theme = theme;
        window.localStorage.setItem('tabular-theme', theme);
    }, [theme]);
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
    const isChartOutput = isChartsPage && location.state?.chartView === true;
    const isComparisonView = location.pathname === `/datasets/${datasetId}/predict` && location.state?.comparisonView === true;
    const canGoBack = isChartsPage ? Boolean(location.state?.returnTo) : currentStage >= 0;
    const showBack = isChartsPage ? !isChartOutput : currentStage >= 0;
    const showForward = currentStage === 1 && !isComparisonView && visited.includes(stages[currentStage + 1]);
    return (<div className="app-root">
      <header className="topbar">
        <Link className="brand" to="/" aria-label="Tabular Workbench home">
          <span className="brand-mark"><Layers3 size={20}/></span>
          <span className="brand-copy"><strong>Tabular</strong><span>WORKBENCH</span></span>
        </Link>
        <button className="theme-toggle" type="button" aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`} title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`} onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}>
          {theme === 'light' ? <Moon size={18}/> : <Sun size={18}/>}
        </button>
      </header>

      {datasetId && (currentStage >= 0 || isChartsPage) && (showBack || showForward) && (<nav className="workflow-nav workflow-arrows" aria-label="Page history">
          {showBack && <button type="button" className="history-arrow" aria-label="Previous page" disabled={!canGoBack} onClick={() => navigate(isChartsPage ? location.state.returnTo : currentStage === 0 ? '/' : stages[currentStage - 1], isChartsPage ? { replace: true } : undefined)}><ArrowLeft size={19}/></button>}
          {showForward && <button type="button" className="history-arrow" aria-label="Next page" onClick={() => navigate(stages[currentStage + 1])}><ArrowRight size={19}/></button>}
        </nav>)}

        <main className="page-container"><Outlet /></main>
    </div>);
}
