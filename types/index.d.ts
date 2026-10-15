// Um pedaço da faixa: uma janela de limite já calculada pra desenhar.
export type Nivel = 'ok' | 'atencao' | 'critico'

export type Segmento = {
  nome: string
  pct: number
  barra: string
  nivel: Nivel
  detalhes: string // "9%/dia · zera sáb 09:00 (sobra ~20%)"
  alerta?: string // "⚠ acaba sex 16:00"
}

declare module 'claude-code' {
  interface PluginState {
    'uso-tokens': { visao: Segmento[]; oculto: boolean }
  }
}
