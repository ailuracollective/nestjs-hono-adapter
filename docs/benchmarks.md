# NestJS adapter benchmark

Measured 2026-10-14T10:41:55.479Z on AMD Ryzen 5 7535HS with Radeon Graphics with 12 logical cores.
Bun 1.4.2, Node 26.10.0.
Connections 100, duration 5s, warmup 3s, 3 runs, medians reported.
Tools: oha 1.16.0.

All targets serve the same Nest application; only the HTTP adapter and runtime change. Results from one machine are comparative, not absolute.

Regenerate from the repository root with `bun run bench`.

## oha

Throughput, median requests per second:

| Scenario | bun | node | express | fastify |
| --- | ---: | ---: | ---: | ---: |
| plaintext | 12,780 | 8,640 | 7,982 | 11,563 |
| json | 12,810 | 8,405 | 8,052 | 12,030 |
| query | 10,570 | 7,382 | 7,586 | 11,433 |
| params | 11,871 | 7,718 | 7,562 | 11,300 |
| post | 10,617 | 6,189 | 6,291 | 9,648 |
| pipeline | 9,463 | 6,701 | 6,264 | 9,587 |
| error | 10,521 | 7,496 | 6,564 | 9,551 |
| cors | 12,625 | 8,355 | 11,600 | 12,412 |

Latency, median p99 in milliseconds:

| Scenario | bun | node | express | fastify |
| --- | ---: | ---: | ---: | ---: |
| plaintext | 12.51 | 19.65 | 16.26 | 12.67 |
| json | 13.48 | 19.60 | 17.22 | 14.64 |
| query | 13.65 | 22.56 | 17.39 | 12.33 |
| params | 12.72 | 20.72 | 17.73 | 12.78 |
| post | 14.25 | 25.27 | 27.36 | 14.47 |
| pipeline | 18.03 | 22.86 | 20.59 | 14.84 |
| error | 15.15 | 19.57 | 21.97 | 14.53 |
| cors | 12.51 | 18.04 | 13.40 | 12.35 |

Errors, median count (`error` and a 418 are expected there):

| Scenario | bun | node | express | fastify |
| --- | ---: | ---: | ---: | ---: |
| plaintext | 0 | 0 | 0 | 0 |
| json | 0 | 0 | 0 | 0 |
| query | 0 | 0 | 0 | 0 |
| params | 0 | 0 | 0 | 0 |
| post | 0 | 0 | 0 | 0 |
| pipeline | 0 | 0 | 0 | 0 |
| error | 52,536 | 37,405 | 32,738 | 47,689 |
| cors | 0 | 0 | 0 | 0 |

CPU, median percent of one core:

| Scenario | bun | node | express | fastify |
| --- | ---: | ---: | ---: | ---: |
| plaintext | 102.0 | 121.0 | 100.2 | 99.6 |
| json | 103.0 | 120.6 | 100.0 | 99.1 |
| query | 102.6 | 119.1 | 99.6 | 99.2 |
| params | 102.8 | 121.3 | 99.6 | 99.3 |
| post | 103.5 | 118.2 | 100.3 | 99.6 |
| pipeline | 104.0 | 117.5 | 99.6 | 99.6 |
| error | 102.5 | 116.7 | 99.6 | 99.4 |
| cors | 102.5 | 107.2 | 99.3 | 99.1 |

CPU cost, median milliseconds per request:

| Scenario | bun | node | express | fastify |
| --- | ---: | ---: | ---: | ---: |
| plaintext | 0.081 | 0.141 | 0.127 | 0.087 |
| json | 0.081 | 0.145 | 0.125 | 0.083 |
| query | 0.098 | 0.161 | 0.133 | 0.088 |
| params | 0.088 | 0.156 | 0.133 | 0.089 |
| post | 0.098 | 0.193 | 0.162 | 0.104 |
| pipeline | 0.110 | 0.176 | 0.160 | 0.105 |
| error | 0.098 | 0.156 | 0.153 | 0.105 |
| cors | 0.082 | 0.129 | 0.086 | 0.081 |

Memory, median mean RSS in mebibytes:

| Scenario | bun | node | express | fastify |
| --- | ---: | ---: | ---: | ---: |
| plaintext | 99.5 | 250.1 | 144.2 | 146.0 |
| json | 95.4 | 244.6 | 150.9 | 147.8 |
| query | 95.1 | 248.8 | 150.4 | 149.9 |
| params | 94.5 | 251.0 | 150.6 | 177.4 |
| post | 96.3 | 255.5 | 186.6 | 178.7 |
| pipeline | 101.4 | 259.5 | 195.9 | 186.8 |
| error | 101.1 | 260.1 | 200.5 | 186.9 |
| cors | 103.1 | 251.1 | 204.2 | 187.0 |

Memory, median peak RSS in mebibytes:

| Scenario | bun | node | express | fastify |
| --- | ---: | ---: | ---: | ---: |
| plaintext | 101.3 | 254.1 | 144.5 | 146.3 |
| json | 97.2 | 245.0 | 151.0 | 147.8 |
| query | 95.8 | 249.8 | 152.2 | 149.9 |
| params | 94.6 | 251.9 | 151.4 | 177.4 |
| post | 97.0 | 256.3 | 187.1 | 178.7 |
| pipeline | 103.0 | 259.7 | 196.6 | 186.8 |
| error | 101.8 | 261.9 | 200.8 | 186.9 |
| cors | 104.6 | 255.3 | 204.2 | 187.1 |

