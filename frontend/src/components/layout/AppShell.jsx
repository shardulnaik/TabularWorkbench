import { ArrowLeft, Info, Moon, Sun } from 'lucide-react';
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
    const namedBackFlow = currentStage === 0 || currentStage === 1;
    const isChartsPage = location.pathname === `/datasets/${datasetId}/explore`;
    const isChartOutput = isChartsPage && location.state?.chartView === true;
    const canGoBack = isChartsPage ? Boolean(location.state?.returnTo) : currentStage >= 0;
    const showBack = isChartsPage ? !isChartOutput : currentStage >= 0;
    const goBack = () => {
        if (isChartsPage) {
            navigate(location.state.returnTo, { replace: true, state: location.state?.returnState });
        }
        else navigate(currentStage === 0 ? '/' : stages[currentStage - 1]);
    };
    return (<div className="app-root">
      <header className="topbar">
        <Link className="brand" to="/" aria-label="Tabular Workbench home">
          <span className="brand-copy"><strong>Tabular Workbench</strong></span>
        </Link>
        <div className="topbar-actions">
          <button className="about-toggle" type="button" aria-label="About this website" aria-expanded={showAbout} onClick={() => setShowAbout((current) => !current)}><Info size={16}/> About</button>
          <button className="theme-toggle" type="button" aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`} title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`} onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}>
            {theme === 'light' ? <Moon size={17} aria-hidden="true"/> : <Sun size={17} aria-hidden="true"/>}
            <span>Switch to {theme === 'light' ? 'dark' : 'light'} mode</span>
          </button>
        </div>
      </header>

      {!showAbout && !namedBackFlow && datasetId && (currentStage >= 0 || isChartsPage) && showBack && (<nav className="workflow-nav workflow-arrows" aria-label="Page history">
          {showBack && <button type="button" className="history-arrow" aria-label="Previous page" disabled={!canGoBack} onClick={goBack}><ArrowLeft size={19}/></button>}
        </nav>)}

        <main className={`page-container${showAbout ? ' page-container-suspended' : ''}`} aria-hidden={showAbout} inert={showAbout}><Outlet /></main>
        {showAbout && <AboutPanel onBack={() => setShowAbout(false)}/>}
    </div>);
}
