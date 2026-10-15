# uso-tokens

Mod pro Claude Code que mostra, logo acima da caixa de mensagem, quanto você já usou do limite da assinatura e onde vai chegar até ele zerar.

```
5h     ▰▰▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱ 17%              previsão ~22% até 11:00
semana ▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▱▱▱ 87%   previsão ~99% até amanhã 06:00 · 14%/dia
```

- **Uma linha por janela**: a de 5 horas e a semanal.
- **Cor pelo uso**: verde até 60%, amarelo até 85%, vermelho acima disso.
- **Previsão**: no ritmo atual, quanto do limite você terá usado quando a janela zerar. Se for passar de 100% antes, aparece `⚠ acaba <hora>` em vermelho.
- **Ritmo da semana** calculado pelo uso dos últimos 3 dias, que o mod vai guardando no seu PC. Nos primeiros dias ele usa a média da semana atual.
- **Horários em Brasília.**
- **`/uso`** ou o **✕** escondem a faixa; `/uso` de novo mostra. A escolha fica salva.

Só funciona em conta de assinatura (Pro/Max), que é onde o Claude Code informa o uso do limite.

## Instalar

No Claude Code, digite:

```
/plugin install uso-tokens --marketplace tetthews/claude-uso-tokens
```

Responda `y` pra adicionar o marketplace e escolha o escopo de usuário. A faixa aparece depois da primeira resposta do Claude.

Precisa de uma versão do Claude Code com suporte a mods (hooks em TypeScript).

## Privacidade

Nada sai do seu computador. O mod lê só o percentual do limite que o próprio Claude Code já mostra, e guarda o histórico no armazenamento local do plugin.

## Licença

MIT
