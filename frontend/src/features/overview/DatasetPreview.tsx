import type { DatasetProfile } from '../../types/dataset';
import { DataPreviewTable } from '../../components/common/DataPreviewTable';

export function DatasetPreview({ profile }: { profile: DatasetProfile }) {
  return <section className="panel"><div className="panel-heading"><div><h2>Preview your data</h2><p>First 10 rows · {profile.column_count} detected columns</p></div></div><DataPreviewTable rows={profile.preview} /></section>;
}
