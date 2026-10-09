export const navigationItems = [
  { id: 'inicio', label: 'Inicio', icon: '⌂' },
  { id: 'calendario', label: 'Calendario', icon: '▦' },
  { id: 'gastos', label: 'Movimientos', icon: '↗' },
  { id: 'estadisticas', label: 'Estadísticas', icon: '▥' },
  { id: 'ajustes', label: 'Ajustes', icon: '⚙' },
] as const

export type NavigationItem = (typeof navigationItems)[number]['id']
