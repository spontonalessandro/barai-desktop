import {
  BarChart3,
  CalendarClock,
  ChefHat,
  ClipboardList,
  Database,
  FileInput,
  Home,
  ListChecks,
  Lock,
  PackageSearch,
  Settings,
  WalletCards
} from 'lucide-react';

const ADMIN_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: Home },
  { id: 'scadenziario', label: 'Scadenziario', icon: CalendarClock },
  { id: 'prima-nota', label: 'Prima Nota', icon: WalletCards },
  { id: 'caricamenti', label: 'Caricamenti', icon: FileInput },
  { id: 'prezzi', label: 'Controllo Prezzi', icon: PackageSearch },
  { id: 'ordine', label: 'Ordini fornitore', icon: ClipboardList },
  { id: 'food-cost', label: 'Food Cost', icon: ChefHat },
  { id: 'admin', label: 'Admin / CE', icon: BarChart3 },
  { id: 'sync', label: 'Sync / Backup', icon: Database },
  { id: 'config', label: 'Config', icon: Settings }
];

const DIPENDENTE_ITEMS = [
  { id: 'prezzi', label: 'Controllo Prezzi', icon: PackageSearch },
  { id: 'ordine', label: 'Ordini fornitore', icon: ClipboardList },
  { id: 'food-cost', label: 'Food Cost', icon: ChefHat },
];

export default function Sidebar({ active, onChange, deviceMode = 'admin', onUnlock }) {
  const items = deviceMode === 'dipendente' ? DIPENDENTE_ITEMS : ADMIN_ITEMS;

  return (
    <aside className="sidebar">
      <div className="brand-block">
        <div className="brand-mark">B</div>
        <div>
          <div className="brand-title">BarAI</div>
          <div className="brand-subtitle">
            {deviceMode === 'dipendente' ? 'Modalità dipendente' : 'Desktop v9.3'}
          </div>
        </div>
      </div>

      <nav className="nav-list">
        {items.map((item) => {
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
        {deviceMode === 'dipendente' ? (
          <button
            onClick={onUnlock}
            style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 0, color: 'rgba(255,247,234,.66)', cursor: 'pointer', fontSize: 12, fontWeight: 850, padding: 0 }}
          >
            <Lock size={14} />
            <span>Accesso admin</span>
          </button>
        ) : (
          <>
            <ListChecks size={16} />
            <span>SQLite locale + moduli separati</span>
          </>
        )}
      </div>
    </aside>
  );
}
