import {
  BarChart3,
  CalendarClock,
  ChefHat,
  Database,
  FileInput,
  Home,
  ListChecks,
  PackageSearch,
  Settings,
  WalletCards
} from 'lucide-react';

const ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: Home },
  { id: 'scadenziario', label: 'Scadenziario', icon: CalendarClock },
  { id: 'prima-nota', label: 'Prima Nota', icon: WalletCards },
  { id: 'caricamenti', label: 'Caricamenti', icon: FileInput },
  { id: 'prezzi', label: 'Controllo Prezzi', icon: PackageSearch },
  { id: 'food-cost', label: 'Food Cost', icon: ChefHat },
  { id: 'admin', label: 'Admin / CE', icon: BarChart3 },
  { id: 'sync', label: 'Sync / Backup', icon: Database },
  { id: 'config', label: 'Config', icon: Settings }
];

export default function Sidebar({ active, onChange }) {
  return (
    <aside className="sidebar">
      <div className="brand-block">
        <div className="brand-mark">B</div>
        <div>
          <div className="brand-title">BarAI</div>
          <div className="brand-subtitle">Desktop v9.1</div>
        </div>
      </div>

      <nav className="nav-list">
        {ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              className={`nav-item ${active === item.id ? 'active' : ''}`}
              onClick={() => onChange(item.id)}
            >
              <Icon size={18} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="sidebar-footer">
        <ListChecks size={16} />
        <span>SQLite locale + moduli separati</span>
      </div>
    </aside>
  );
}
