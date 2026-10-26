import { ArrowLeft, ArrowRight, Info, Moon, Sun } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { AboutPanel } from '../../pages/AboutPanel';
export function AppShell() {
    const location = useLocation();
    const navigate = useNavigate();
    const [theme, setTheme] = useState(() => window.localStorage.getItem('tabular-theme') || 'light');
    const [showAbout, setShowAbout] = useState(false);
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
    const isPredictPage = location.pathname === `/datasets/${datasetId}/predict`;
    const isChartOutput = isChartsPage && location.state?.chartView === true;
    const canGoBack = isChartsPage ? Boolean(location.state?.returnTo) : currentStage >= 0;
    const showBack = isChartsPage ? !isChartOutput : currentStage >= 0;
    const showForward = isPredictPage && Boolean(location.state?.comparisonResult) && !location.state?.comparisonView;
    const goBack = () => {
        if (isChartsPage) {
            navigate(location.state.returnTo, { replace: true, state: location.state?.returnState });
        }
        else if (isPredictPage && location.state?.comparisonView && location.state?.comparisonResult) {
            navigate(location.pathname, { replace: true, state: { ...location.state, comparisonView: false } });
        }
        else if (currentStage === 2 && location.state?.comparisonResult) {
            navigate(stages[1], { state: { ...location.state, comparisonView: true } });
        }
        else {
            navigate(currentStage === 0 ? '/' : stages[currentStage - 1]);
        }
    };
    return (<div className="app-root">
      <header className="topbar">
        <Link className="brand" to="/" aria-label="Tabular Workbench home">
          <span className="brand-copy"><strong>Tabular Workbench</strong></span>
        </Link>
        <div className="topbar-actions">
          <button className="about-toggle" type="button" aria-label="About this website" aria-expanded={showAbout} onClick={() => setShowAbout((current) => !current)}><Info size={16}/> About</button>
          <button className="theme-toggle" type="button" aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`} title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`} onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}>
            {theme === 'light' ? <Moon size={18}/> : <Sun size={18}/>}
          </button>
        </div>
      </header>

      {!showAbout && datasetId && (currentStage >= 0 || isChartsPage) && (showBack || showForward) && (<nav className="workflow-nav workflow-arrows" aria-label="Page history">
          {showBack && <button type="button" className="history-arrow" aria-label="Previous page" disabled={!canGoBack} onClick={goBack}><ArrowLeft size={19}/></button>}
          {showForward && <button type="button" className="history-arrow" aria-label="Open model selection" onClick={() => navigate(location.pathname, { replace: true, state: { ...location.state, comparisonView: true } })}><ArrowRight size={19}/></button>}
        </nav>)}

        <main className={`page-container${showAbout ? ' page-container-suspended' : ''}`} aria-hidden={showAbout} inert={showAbout}><Outlet /></main>
        {showAbout && <AboutPanel onBack={() => setShowAbout(false)}/>}
    </div>);
}
