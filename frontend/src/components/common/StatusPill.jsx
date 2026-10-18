export function StatusPill({ children, tone = 'neutral' }) {
    return <span className={`status-pill tone-${tone}`}>{children}</span>;
}
