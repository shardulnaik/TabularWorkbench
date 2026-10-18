import { Layers3 } from 'lucide-react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
const steps = [
    { suffix: '', label: 'Data' },
    { suffix: '/explore', label: 'Charts' },
    { suffix: '/predict', label: 'Models' },
];
export function AppShell() {
    const location = useLocation();
    const match = location.pathname.match(/^\/datasets\/([^/]+)/);
    const datasetId = match?.[1];
    const activePath = location.pathname;
    return (<div className="app-root">
      <header className="topbar">
        <Link className="brand" to="/" aria-label="Tabular Workbench home">
          <span className="brand-mark"><Layers3 size={20}/></span>
          <span className="brand-copy"><strong>Tabular</strong><span>WORKBENCH</span></span>
        </Link>
      </header>

      {datasetId && (<nav className="workflow-nav" aria-label="Dataset workflow">
          {steps.map((step) => {
                const href = `/datasets/${datasetId}${step.suffix}`;
                const isActive = activePath === href
                    || (step.suffix === '/predict' && activePath.endsWith('/results'));
                const isChildActive = step.suffix === '' && activePath === `/datasets/${datasetId}`;
                return (<NavLink key={step.suffix} to={href} className={`workflow-step ${isActive || isChildActive ? 'is-active' : ''}`}>
                <span>{step.label}</span>
              </NavLink>);
            })}
        </nav>)}

        <main className="page-container"><Outlet /></main>
    </div>);
}
