// Cálculo puro: histórico, ritmo de consumo e os pedaços da faixa.
// Nada aqui chama o engine, pra dar pra testar com números fixos.

import type { Nivel, Segmento } from '../types'

export type Janela = { kind: string; percentUsed: number; resetsAt?: string }

// Uma leitura guardada no $.store: quando, qual janela, quanto %.
export type Amostra = { t: number; k: string; p: number }

const HORA = 3_600_000
const DIA = 24 * HORA
const GUARDA_DIAS = 14
const INTERVALO_MIN = 10 * 60_000
const RITMO_HORAS = 72

const DURACAO: Record<string, number> = { five_hour: 5 * HORA, seven_day: 7 * DIA }

// Junta as leituras novas no histórico: grava se a % mudou ou se passaram 10 min.
export function registrar(hist: Amostra[], janelas: Janela[], agora: number): Amostra[] {
  const novo = hist.filter(a => a.t >= agora - GUARDA_DIAS * DIA)

  for (const j of janelas) {
    const ultima = [...novo].reverse().find(a => a.k === j.kind)
    const mudou = !ultima || ultima.p !== j.percentUsed
    const velha = !ultima || agora - ultima.t >= INTERVALO_MIN

    if (mudou || velha) {
      novo.push({ t: agora, k: j.kind, p: j.percentUsed })
    }
  }

  return novo
}

// % por hora nas últimas 72 h. Quando a janela zera no meio, o que subiu
// depois do reset conta a partir do zero. Null se o histórico ainda é curto.
export function ritmoHistorico(hist: Amostra[], kind: string, agora: number): number | null {
  const desde = agora - RITMO_HORAS * HORA
  const doTipo = hist.filter(a => a.k === kind).sort((a, b) => a.t - b.t)
  const antes = doTipo.filter(a => a.t < desde).pop()
  const trecho = [...(antes ? [antes] : []), ...doTipo.filter(a => a.t >= desde)]

  const primeira = trecho[0]
  if (!primeira || trecho.length < 2) return null

  const inicio = Math.max(primeira.t, desde)
  const horas = (agora - inicio) / HORA
  if (horas < 6) return null

  let subiu = 0
  let a = primeira.p
  for (const { p: b } of trecho.slice(1)) {
    subiu += b >= a ? b - a : b
    a = b
  }

  return subiu / horas
}

// % por hora desde que a janela atual começou (início = reset − duração).
export function ritmoDaJanela(j: Janela, agora: number): number | null {
  const dur = DURACAO[j.kind]
  if (!j.resetsAt || !dur) return null

  const inicio = Date.parse(j.resetsAt) - dur
  const horas = (agora - inicio) / HORA
  if (horas < 0.25) return null

  return j.percentUsed / horas
}

export type Previsao = {
  acabaEm: number | null // ms; null se o ritmo é zero
  zeraEm: number | null
  acabaAntes: boolean
  sobraNoReset: number | null // % livre quando zerar, se não acabar antes
}

export function prever(j: Janela, ritmo: number | null, agora: number): Previsao {
  const zeraEm = j.resetsAt ? Date.parse(j.resetsAt) : null
  const falta = Math.max(0, 100 - j.percentUsed)

  if (!ritmo || ritmo <= 0) {
    return { acabaEm: null, zeraEm, acabaAntes: false, sobraNoReset: zeraEm ? falta : null }
  }

  const acabaEm = agora + (falta / ritmo) * HORA
  const acabaAntes = zeraEm !== null && acabaEm < zeraEm
  const sobraNoReset =
    zeraEm !== null && !acabaAntes
      ? Math.max(0, 100 - (j.percentUsed + ritmo * ((zeraEm - agora) / HORA)))
      : null

  return { acabaEm, zeraEm, acabaAntes, sobraNoReset }
}

// ---- texto ----

const DIAS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']
const BRT = -3 * HORA // Brasília, sem horário de verão desde 2019

const dois = (n: number) => String(n).padStart(2, '0')

export function horaBrt(ms: number): string {
  const d = new Date(ms + BRT)
  return `${dois(d.getUTCHours())}:${dois(d.getUTCMinutes())}`
}

// "14:20" (hoje), "amanhã 09:00" ou "sáb 09:00"
export function quandoBrt(ms: number, agora: number): string {
  const dia = (x: number) => Math.floor((x + BRT) / DIA)
  const diff = dia(ms) - dia(agora)
  if (diff === 0) return horaBrt(ms)
  const quando = diff === 1 ? 'amanhã' : DIAS[new Date(ms + BRT).getUTCDay()]
  return `${quando} ${horaBrt(ms)}`
}

export function barra(pct: number, celulas = 8): string {
  const cheias = Math.min(celulas, Math.round((Math.min(100, pct) / 100) * celulas))
  return '▰'.repeat(cheias) + '▱'.repeat(celulas - cheias)
}

const NOME: Record<string, string> = { five_hour: '5h', seven_day: 'semana', spend_limit: 'gasto' }
const pct = (n: number) => `${Math.round(n)}%`

export function segmento(j: Janela, hist: Amostra[], agora: number): Segmento {
  // Semanal: ritmo dos últimos dias; 5h (ou histórico curto): ritmo da janela atual.
  const ritmo =
    (j.kind === 'seven_day' ? ritmoHistorico(hist, j.kind, agora) : null) ?? ritmoDaJanela(j, agora)
  const p = prever(j, ritmo, agora)

  // "previsão ~45% até 11:00": onde o uso chega, no ritmo atual, quando a janela zerar.
  // Se acaba antes, o alerta diz quando e aqui fica só a hora do reset.
  const detalhes: string[] = []
  if (p.zeraEm !== null) {
    const quando = quandoBrt(p.zeraEm, agora)
    detalhes.push(
      p.sobraNoReset !== null ? `previsão ~${pct(100 - p.sobraNoReset)} até ${quando}` : `zera ${quando}`,
    )
  }
  if (j.kind === 'seven_day' && ritmo) {
    detalhes.push(`${pct(ritmo * 24)}/dia`)
  }

  const nivel: Nivel =
    p.acabaAntes || j.percentUsed >= 85 ? 'critico' : j.percentUsed >= 60 ? 'atencao' : 'ok'

  return {
    nome: NOME[j.kind] ?? j.kind,
    pct: Math.round(j.percentUsed),
    barra: barra(j.percentUsed),
    nivel,
    detalhes: detalhes.join(' · '),
    ...(p.acabaAntes && p.acabaEm !== null ? { alerta: `⚠ acaba ${quandoBrt(p.acabaEm, agora)}` } : {}),
  }
}

export function montarVisao(janelas: Janela[], hist: Amostra[], agora: number): Segmento[] {
  const ordem = (k: string) => (k === 'five_hour' ? 0 : k === 'seven_day' ? 1 : 2)
  return [...janelas]
    .sort((a, b) => ordem(a.kind) - ordem(b.kind))
    .map(j => segmento(j, hist, agora))
}
