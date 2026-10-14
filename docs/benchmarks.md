# NestJS adapter benchmark

Measured 2026-10-14T08:33:23.121Z on AMD Ryzen 5 7535HS with Radeon Graphics with 12 logical cores.
Bun 1.4.2, Node 26.10.0.
Connections 100, duration 5s, warmup 3s, 3 runs, medians reported.
Tools: oha 1.16.0.

All targets serve the same Nest application; only the HTTP adapter and runtime change. Results from one machine are comparative, not absolute.

Regenerate from the repository root with `bun run bench`.

## oha

Throughput, median requests per second:

| Scenario | bun | node | express | fastify |
| --- | ---: | ---: | ---: | ---: |
| plaintext | 12,806 | 7,372 | 8,837 | 11,399 |
| json | 12,835 | 7,432 | 8,812 | 9,543 |
| query | 10,863 | 6,841 | 8,349 | 12,355 |
| params | 11,940 | 7,152 | 8,403 | 12,591 |
| post | 3,149 | 4,285 | 5,421 | 10,242 |
| pipeline | 9,605 | 6,355 | 5,777 | 9,981 |
| error | 10,920 | 6,482 | 6,416 | 10,315 |
| cors | 14,829 | 9,530 | 7,021 | 14,001 |

Latency, median p99 in milliseconds:

| Scenario | bun | node | express | fastify |
| --- | ---: | ---: | ---: | ---: |
| plaintext | 10.76 | 20.20 | 12.52 | 10.98 |
| json | 10.92 | 19.10 | 12.86 | 16.15 |
| query | 12.01 | 21.10 | 13.64 | 9.40 |
| params | 11.45 | 19.63 | 13.62 | 9.11 |
| post | 40.76 | 35.39 | 37.76 | 11.25 |
| pipeline | 16.57 | 24.14 | 22.14 | 12.12 |
| error | 13.92 | 21.86 | 20.01 | 18.12 |
| cors | 9.87 | 14.57 | 18.44 | 8.47 |

Errors, median count (`error` and a 418 are expected there):

| Scenario | bun | node | express | fastify |
| --- | ---: | ---: | ---: | ---: |
| plaintext | 0 | 0 | 0 | 0 |
| json | 0 | 0 | 0 | 0 |
| query | 0 | 0 | 0 | 0 |
| params | 0 | 0 | 0 | 0 |
| post | 0 | 0 | 0 | 0 |
| pipeline | 0 | 0 | 0 | 0 |
| error | 54,533 | 32,333 | 31,989 | 51,495 |
| cors | 0 | 0 | 0 | 0 |

