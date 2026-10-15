import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import { barra, montarVisao, registrar } from './previsao'
import type { Amostra, Janela } from './previsao'
import type { Nivel, Segmento } from '../types'

const CHAVE = 'historico'
const OCULTO = 'oculto'
const visao = atom({ plugin: 'uso-tokens', key: 'visao' } as const, [])
const oculto = atom({ plugin: 'uso-tokens', key: 'oculto' } as const, false)

const COR: Record<Nivel, 'success' | 'warning' | 'error'> = {
  ok: 'success',
  atencao: 'warning',
  critico: 'error',
}

// Última leitura vista nesta sessão, pra o timer recalcular sem turno novo.
let ultimas: Janela[] = []

async function lerHistorico($: EngineInterface): Promise<Amostra[]> {
  const v = await $.store.get(CHAVE)
  return Array.isArray(v) ? (v as Amostra[]) : []
}

// Guarda a leitura e recalcula a faixa.
async function atualizar($: EngineInterface, janelas: Janela[]) {
  if (janelas.length === 0) return

  const agora = await $.clock.now()
  ultimas = janelas
  const hist = registrar(await lerHistorico($), janelas, agora)
  await $.store.set(CHAVE, hist)
  await update($, visao, () => montarVisao(janelas, hist, agora))
}

// O "acaba às" e o "hoje/amanhã" andam com o relógio mesmo sem turno novo.
async function recalcular($: EngineInterface) {
  if (ultimas.length === 0) return
  const agora = await $.clock.now()
  const hist = await lerHistorico($)
  await update($, visao, () => montarVisao(ultimas, hist, agora))
}

// Ocultar/aparecer vale pra toda sessão nova também (fica no $.store).
async function mostrar($: EngineInterface, isOculto: boolean) {
  await $.store.set(OCULTO, isOculto)
  await update($, oculto, () => isOculto)
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const r = await next(e)
    $.ui.status(undefined) // a versão antiga escrevia na barra de status
    const salvo = (await $.store.get(OCULTO)) === true
    await update($, oculto, () => salvo)
    await $.command.register({ name: 'uso', description: 'Mostra ou oculta a faixa de uso do limite' })
    const { rateLimits } = await $.session.usage()
    await atualizar($, rateLimits)
    $.clock.every(5 * 60_000, () => recalcular($))
    return r
  })

  on('session.measure', async ($, e, next) => {
    if (e.changed.includes('rateLimits')) {
      await atualizar($, e.rateLimits)
    }
    return next(e)
  })

  on('command.run', { command: 'uso' }, async $ => {
    const agora = !(await read($, oculto))
    await mostrar($, agora)
    return { text: agora ? 'Faixa de uso oculta. /uso de novo pra mostrar.' : 'Faixa de uso de volta.' }
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const segs = await read($, visao)
    if (e.props.hasSurvey || segs.length === 0 || (await read($, oculto))) {
      return next(e)
    }

    const { Box, Button, Text } = $.ui.resolve(e)

    // Uma linha por janela. A barra estica pra ocupar a largura que sobra e o
    // texto fica encostado no fim; as duas barras têm o mesmo tamanho.
    const largura = Math.max(...segs.map(s => s.nome.length))
    const fim = (s: Segmento) => (s.alerta ? s.alerta.length + 1 : 0) + s.detalhes.length
    const sobra = e.props.bodyColumns - largura - 1 - 5 - Math.max(...segs.map(fim)) - 2 - 12 - 4 // bordinha, respiro e o ✕
    const celulas = Math.max(8, Math.min(60, sobra))

    return (
      <Box flexDirection="column" paddingX={1}>
        {segs.map((s, i) => (
          <Box key={s.nome} flexWrap="nowrap" justifyContent="space-between">
            <Box flexShrink={0}>
              <Text dimColor>{s.nome.padEnd(largura)} </Text>
              <Text color={COR[s.nivel]}>{barra(s.pct, celulas)} </Text>
              <Text color={COR[s.nivel]} bold>
                {s.pct}%
              </Text>
            </Box>
            <Box flexShrink={1} marginLeft={3}>
              {s.alerta ? (
                <Text color="error" bold>
                  {s.alerta}{' '}
                </Text>
              ) : null}
              <Text dimColor wrap="truncate-end">
                {s.detalhes}
              </Text>
              {i === 0 ? <Button key="ocultar" label="✕" onPress={() => mostrar($, true)} /> : null}
            </Box>
          </Box>
        ))}
      </Box>
    )
  })
}
