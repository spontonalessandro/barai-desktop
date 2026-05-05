import { statusClass } from '../utils/format.js';

export default function StatusBadge({ stato }) {
  return <span className={`badge badge-${statusClass(stato)}`}>{stato || '-'}</span>;
}
