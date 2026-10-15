import { expect, test } from 'claude-code/testing'

import { barra, montarVisao, prever, quandoBrt, registrar, ritmoHistorico } from './previsao'
import type { Amostra } from './previsao'

const HORA = 3_600_000
// qua 15/10/2026 12:00 em Brasília = 15:00 UTC
const AGORA = Date.parse('2026-10-15T15:00:00Z')

test('barra enche proporcional', async () => {
  expect(barra(0)).toBe('▱▱▱▱▱▱▱▱')
  expect(barra(62)).toBe('▰▰▰▰▰▱▱▱')
  expect(barra(130)).toBe('▰▰▰▰▰▰▰▰')
})

test('hora sai em Brasília', async () => {
  expect(quandoBrt(AGORA, AGORA)).toBe('12:00')
  expect(quandoBrt(AGORA + 24 * HORA, AGORA)).toBe('amanhã 12:00')
  expect(quandoBrt(Date.parse('2026-10-17T12:00:00Z'), AGORA)).toBe('sáb 09:00')
})

test('ritmo soma o que subiu, inclusive depois de zerar', async () => {
  const hist: Amostra[] = [
    { t: AGORA - 48 * HORA, k: 'seven_day', p: 80 },
    { t: AGORA - 24 * HORA, k: 'seven_day', p: 90 },
    { t: AGORA - 20 * HORA, k: 'seven_day', p: 4 }, // zerou e já subiu 4
    { t: AGORA, k: 'seven_day', p: 14 },
  ]
  // 10 + 4 + 10 = 24 pontos em 48 h
  expect(ritmoHistorico(hist, 'seven_day', AGORA)).toBe(0.5)
})

test('avisa quando acaba antes de zerar', async () => {
  const j = { kind: 'seven_day', percentUsed: 80, resetsAt: new Date(AGORA + 48 * HORA).toISOString() }
  const p = prever(j, 1, AGORA) // 20 pontos a 1%/h = 20 h
  expect(p.acabaAntes).toBe(true)
  expect(p.acabaEm).toBe(AGORA + 20 * HORA)

  const folgado = prever(j, 0.25, AGORA) // em 48 h sobe 12 → sobra 8
  expect(folgado.acabaAntes).toBe(false)
  expect(folgado.sobraNoReset).toBe(8)
})

test('registrar não repete leitura igual em menos de 10 min', async () => {
  const j = [{ kind: 'five_hour', percentUsed: 30 }]
  const um = registrar([], j, AGORA)
  expect(registrar(um, j, AGORA + 60_000).length).toBe(1)
  expect(registrar(um, [{ kind: 'five_hour', percentUsed: 31 }], AGORA + 60_000).length).toBe(2)
})

test('visão ordena e pinta pelo nível', async () => {
  const v = montarVisao(
    [
      { kind: 'seven_day', percentUsed: 62, resetsAt: '2026-10-17T12:00:00Z' },
      { kind: 'five_hour', percentUsed: 34, resetsAt: '2026-10-15T17:20:00Z' },
    ],
    [],
    AGORA,
  )
  expect(v.map(s => s.nome)).toEqual(['5h', 'semana'])
  expect(v[0]?.nivel).toBe('ok')
  expect(v[1]?.barra).toBe('▰▰▰▰▰▱▱▱')
  expect(v[1]?.nivel).toBe('atencao')
  expect(v[1]?.detalhes).toContain('até sáb 09:00')
  expect(v[0]?.detalhes).toBe('previsão ~64% até 14:20') // 34% em 2h40 → ~64% em mais 2h20
  expect(montarVisao([], [], AGORA)).toEqual([])
})

test('vira crítico quando acaba antes de zerar', async () => {
  // 50% em 1 h de janela de 5h: a 50%/h acaba em 1 h, antes do reset
  const [s] = montarVisao([{ kind: 'five_hour', percentUsed: 50, resetsAt: new Date(AGORA + 4 * HORA).toISOString() }], [], AGORA)
  expect(s?.nivel).toBe('critico')
  expect(s?.alerta).toBe('⚠ acaba 13:00')
})
