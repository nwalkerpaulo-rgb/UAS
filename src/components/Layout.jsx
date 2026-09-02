import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import SessionHud from './SessionHud'

// Estrutura agrupada por módulo. Itens sem "to" ainda não têm ecrã próprio
// (ficam esbatidos como "brevemente") — vão sendo ligados à medida que se constrói.
const NAV_GROUPS = [
  {
    label: null,
    items: [
      { to: '/', label: 'Início', icon: '◈', exact: true },
      { to: '/alertas', label: 'Alertas', icon: '⚠' },
      { to: '/configuracoes', label: 'Configurações', icon: '⚙' },
    ],
  },
  {
    label: 'Operações',
    icon: '◉',
    items: [
      { to: '/missoes', label: 'Missões', icon: '⟡' },
      { to: '/operacoes-vivo', label: 'Operações ao vivo', icon: '▶' },
      { to: '/missoes/planeamento', label: 'Planeamento', icon: '▦' },
      { to: '/sessoes', label: 'Histórico de serviços', icon: '▤' },
    ],
  },
  {
    label: 'UAS',
    icon: '◆',
    items: [
      { to: '/drones', label: 'Drones', icon: '✈' },
      { to: '/baterias', label: 'Baterias', icon: '⚡' },
      { to: '/equipamento', label: 'Equipamentos', icon: '▣' },
    ],
  },
  {
    label: 'C-UAS',
    icon: '◇',
    items: [
      { to: '/contra-drone', label: 'Sistemas', icon: '◎' },
      { to: '/deteccoes', label: 'Deteções', icon: '◈' },
      { to: '/incidentes', label: 'Incidentes', icon: '▲' },
    ],
  },
  {
    label: 'Pilotos',
    icon: '♙',
    items: [
      { to: '/pilotos', label: 'Pilotos', icon: '◉', adminOnly: true },
      { to: '/utilizadores', label: 'Utilizadores', icon: '☰' },
    ],
  },
  {
    label: 'Mapas',
    icon: '⌁',
    items: [
      { to: '/mapa', label: 'Operações', icon: '⌁' },
      { to: '/heatmaps', label: 'Heatmaps', icon: '⌁' },
      { to: '/bases', label: 'Bases', icon: '⌂' },
    ],
  },
  {
    label: 'Gestão',
    icon: '⚙',
    items: [
      { to: '/manutencao', label: 'Manutenção', icon: '⚙' },
      { to: '/analise', label: 'Análise', icon: '▥' },
      { to: '/relatorios', label: 'Relatórios', icon: '▤' },
    ],
  },
]

function roleLabel(role) {
  return { admin: 'Admin', gestor: 'Gestor', piloto: 'Piloto', observador: 'Observador' }[role] || role
}

function NavItem({ item }) {
  if (item.soon || !item.to) {
    return (
      <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-sm text-muted/40 cursor-default">
        <span className="opacity-50 w-4 text-center">{item.icon}</span>
        {item.label}
        <span className="ml-auto text-[9px] mono uppercase tracking-wide">brevemente</span>
      </div>
    )
  }
  return (
    <NavLink
      to={item.to}
      end={item.exact}
      className={({ isActive }) =>
        `focus-ring flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${
          isActive ? 'bg-amber/10 text-amber' : 'text-muted hover:text-ink hover:bg-panel2'
        }`
      }
    >
      <span className="opacity-70 w-4 text-center">{item.icon}</span>
      {item.label}
    </NavLink>
  )
}

export default function Layout() {
  const { profile, signOut, isAdminOrManager } = useAuth()
  const navigate = useNavigate()

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  const groups = NAV_GROUPS.map((g) => ({
    ...g,
    items: g.items.filter((item) => !item.adminOnly || isAdminOrManager),
  })).filter((g) => g.items.length > 0)

  const flatForMobile = groups.flatMap((g) => g.items).filter((i) => i.to)

  return (
    <div className="min-h-screen bg-base flex">
      {/* Sidebar — desktop */}
      <aside className="hidden md:flex md:flex-col w-60 shrink-0 border-r border-border bg-panel">
        <div className="h-16 flex items-center gap-2 px-4 border-b border-border">
          <img src="/icon-192.png" alt="" className="w-8 h-8 rounded" />
          <div className="font-display font-bold text-ink leading-tight">
            GIOP
            <div className="text-[10px] font-normal text-muted">UAS C-UAS Operações</div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-4">
          {groups.map((group, gi) => (
            <div key={gi}>
              {group.label && (
                <p className="px-3 mb-1 mono text-[10px] uppercase tracking-widest text-muted/70">
                  {group.icon} {group.label}
                </p>
              )}
              <div className="space-y-0.5">
                {group.items.map((item) => (
                  <NavItem key={item.to || item.label} item={item} />
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div className="border-t border-border p-3">
          {profile && (
            <div className="mb-2 px-1">
              <div className="text-sm text-ink leading-tight truncate">{profile.full_name}</div>
              <div className="mono text-xs text-muted leading-tight">{roleLabel(profile.role)}</div>
            </div>
          )}
          <button
            onClick={handleSignOut}
            className="focus-ring w-full text-xs px-3 py-1.5 rounded-md border border-border text-muted hover:text-alert hover:border-alert/50 transition-colors"
          >
            Sair
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <SessionHud />

        {/* Topbar mobile */}
        <header className="md:hidden border-b border-border bg-panel">
          <div className="h-14 flex items-center gap-2 px-4">
            <img src="/icon-192.png" alt="" className="w-7 h-7 rounded" />
            <div className="font-display font-bold text-ink text-sm">GIOP UAS C-UAS</div>
            <button
              onClick={handleSignOut}
              className="focus-ring ml-auto text-xs px-3 py-1.5 rounded-md border border-border text-muted"
            >
              Sair
            </button>
          </div>
          <nav className="flex items-center gap-1 px-3 pb-2 overflow-x-auto">
            {flatForMobile.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.exact}
                className={({ isActive }) =>
                  `focus-ring px-2.5 py-1 rounded-md text-xs whitespace-nowrap ${
                    isActive ? 'bg-amber/10 text-amber' : 'text-muted'
                  }`
                }
              >
                {item.icon} {item.label}
              </NavLink>
            ))}
          </nav>
        </header>

        <main className="flex-1 w-full max-w-6xl mx-auto px-4 py-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
