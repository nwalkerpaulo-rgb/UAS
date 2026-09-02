export function Card({ children, className = '' }) {
  return (
    <div className={`bg-panel border border-border rounded-xl p-5 ${className}`}>
      {children}
    </div>
  )
}

export function Button({ children, variant = 'primary', className = '', ...props }) {
  const styles = {
    primary: 'bg-amber text-base font-medium hover:bg-amber/90',
    secondary: 'bg-panel2 text-ink border border-border hover:border-amber/50',
    danger: 'bg-alert/10 text-alert border border-alert/30 hover:bg-alert/20',
    ghost: 'text-muted hover:text-ink',
  }
  return (
    <button
      className={`focus-ring px-4 py-2 rounded-lg text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${styles[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}

export function Input({ label, className = '', ...props }) {
  return (
    <label className="block">
      {label && <span className="block text-xs text-muted mb-1.5">{label}</span>}
      <input
        className={`focus-ring w-full bg-panel2 border border-border rounded-lg px-3 py-2 text-sm text-ink placeholder:text-muted ${className}`}
        {...props}
      />
    </label>
  )
}

export function Select({ label, children, className = '', ...props }) {
  return (
    <label className="block">
      {label && <span className="block text-xs text-muted mb-1.5">{label}</span>}
      <select
        className={`focus-ring w-full bg-panel2 border border-border rounded-lg px-3 py-2 text-sm text-ink ${className}`}
        {...props}
      >
        {children}
      </select>
    </label>
  )
}

export function Textarea({ label, className = '', ...props }) {
  return (
    <label className="block">
      {label && <span className="block text-xs text-muted mb-1.5">{label}</span>}
      <textarea
        className={`focus-ring w-full bg-panel2 border border-border rounded-lg px-3 py-2 text-sm text-ink placeholder:text-muted ${className}`}
        {...props}
      />
    </label>
  )
}

const STATUS_STYLES = {
  operacional: 'bg-ok/10 text-ok border-ok/30',
  manutencao: 'bg-amber/10 text-amber border-amber/30',
  inativo: 'bg-muted/10 text-muted border-muted/30',
  aberta: 'bg-amber/10 text-amber border-amber/30',
  fechada: 'bg-cyan/10 text-cyan border-cyan/30',
  completa: 'bg-ok/10 text-ok border-ok/30',
  concluida: 'bg-ok/10 text-ok border-ok/30',
  falhada: 'bg-alert/10 text-alert border-alert/30',
  cua: 'bg-alert/10 text-alert border-alert/30',
  baixa: 'bg-muted/10 text-muted border-muted/30',
  media: 'bg-amber/10 text-amber border-amber/30',
  alta: 'bg-alert/10 text-alert border-alert/30',
  critica: 'bg-alert/20 text-alert border-alert/50',
}

export function Badge({ status, children }) {
  const style = STATUS_STYLES[status] || 'bg-muted/10 text-muted border-muted/30'
  return (
    <span className={`mono text-xs px-2 py-0.5 rounded-full border uppercase tracking-wide ${style}`}>
      {children}
    </span>
  )
}

export function EmptyState({ title, hint, action }) {
  return (
    <div className="text-center py-16 border border-dashed border-border rounded-xl">
      <p className="text-ink font-medium">{title}</p>
      {hint && <p className="text-muted text-sm mt-1">{hint}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
