# Curvas de proteção

O CalcCabos só libera a verificação automática de atuação quando o circuito
possui evidência suficiente do dispositivo utilizado:

- fabricante;
- curva identificada;
- fonte do catálogo ou datasheet;
- pontos documentados da curva tempo-corrente;
- `In`, `Icc` no fim do circuito e tempo limite informado.

Os pontos são enviados em `protecao_curva_pontos`:

```json
[
  { "multiplo_in": 5, "tempo_max_s": 0.2 },
  { "multiplo_in": 250, "tempo_max_s": 0.05 }
]
```

`tempo_max_s` representa o limite superior documentado para aquele múltiplo de
`In`. O motor interpola em escala log-log somente dentro da faixa informada.
Fora da faixa, o resultado permanece `NOT_EVALUATED`; não há extrapolação.

`OK` significa apenas que os pontos fornecidos atendem ao tempo limite
informado. A fonte deve ser conferida pelo responsável técnico e não substitui
a validação profissional, a coordenação/seletividade ou a análise completa do
dispositivo e da instalação.
