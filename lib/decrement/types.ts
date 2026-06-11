// État de la veille « Décrément » — partagé par le cron, l'API et le dashboard.
export interface MonitoringRun {
  date: string // ISO
  nouveaux: number
  majs: number
  statut: string // 'ok' | 'rien' | 'erreur'
  details?: string
}

export interface MonitoringState {
  frequence: string
  dossier: string | null
  lastCheck: string | null
  statut: string // 'ok' | 'erreur' | 'à configurer'
  nouveaux: number
  majs: number
  historique: MonitoringRun[]
}
