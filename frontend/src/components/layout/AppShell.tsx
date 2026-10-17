import { Database, Layers3, Sparkles } from 'lucide-react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';

const steps = [
  { suffix: '', label: 'Dataset health', number: '01' },
  { suffix: '/cleaning', label: 'Cleaning', number: '02' },
  { suffix: '/explore', label: 'Explore', number: '03' },
  { suffix: '/predict', label: 'Predict', number: '04' },
  { suffix: '/results', label: 'Results', number: '05' },
];

export function AppShell() {
  const location = useLocation();
  const match = location.pathname.match(/^\/datasets\/([^/]+)/);
  const datasetId = match?.[1];
  const activePath = location.pathname;

  return (
    <div className="app-root">
      <header className="topbar">
        <Link className="brand" to="/" aria-label="Tabular Workbench home">
          <span className="brand-mark"><Layers3 size={20} /></span>
          <span className="brand-copy"><strong>Tabular</strong><span>WORKBENCH</span></span>
        </Link>
        <div className="topbar-right"><span className="product-pill"><Sparkles size={14} /> Data workflow</span><span className="user-dot">TW</span></div>
      </header>

      {datasetId && (
        <nav className="workflow-nav" aria-label="Dataset workflow">
          <Link className={`workflow-step ${activePath === '/' ? 'is-active' : ''}`} to="/">
            <span className="step-number"><Database size={14} /></span><span>Upload</span>
          </Link>
          {steps.map((step) => {
            const href = `/datasets/${datasetId}${step.suffix}`;
            const isActive = activePath === href;
            const isChildActive = step.suffix === '' && activePath === `/datasets/${datasetId}`;
            return (
              <NavLink key={step.suffix} to={href} className={`workflow-step ${isActive || isChildActive ? 'is-active' : ''}`}>
                <span className="step-number">{step.number}</span><span>{step.label}</span>
              </NavLink>
            );
          })}
        </nav>
      )}

      <main className="page-container"><Outlet /></main>
      <footer className="site-footer"><span>Tabular Workbench</span><span>Understand your data. Keep decisions traceable.</span></footer>
    </div>
  );
}
