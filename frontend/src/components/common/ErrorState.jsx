import { AlertCircle } from 'lucide-react';
export function ErrorState({ message, onRetry }) {
    return <div className="alert alert-error"><AlertCircle size={19}/><div className="alert-content"><strong>We couldn't complete that step</strong><p>{message}</p>{onRetry && <button className="button button-secondary button-small" onClick={onRetry}>Try again</button>}</div></div>;
}
