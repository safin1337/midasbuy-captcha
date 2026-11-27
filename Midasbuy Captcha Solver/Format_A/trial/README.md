# Slider trial data

Live solver extension attempts allocate `trial1/`, `trial2/`, and so on here under
`Midasbuy Captcha Solver/Format_A/trial`, without reusing an
existing folder. Each trial contains:

- `initial.png`: the exact analysis input image.
- `annotated.png`: proposed piece/gap locations and measurements.
- `after.png`: final capture after release, when available. No mid-drag captures.
- `analysis.json`: detector output, including uncertainty and X-relative coordinates.
- `trial.json`: initial plan, UTC timestamps, observed DOM positions, each movement,
  remaining distance, estimated movement scale, and final status/error.

The mouse stays held during the three stages. Intermediate feedback reads DOM
coordinates, without intermediate screen captures. `input_sent` or `aligned` means
the movement was sent or horizontal alignment met tolerance; it does not mean the
website accepted verification. A stopped or disconnected attempt may remain
`in_progress`; its last saved event shows where it ended. Old trial folders are kept.
