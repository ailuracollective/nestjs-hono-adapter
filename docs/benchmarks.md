# NestJS adapter benchmark

Measured 2026-10-14T11:15:13.850Z on AMD Ryzen 5 7535HS with Radeon Graphics with 12 logical cores.
Bun 1.4.2, Node 26.10.0.
Connections 100, duration 5s, warmup 3s, 3 runs, medians reported.
Tools: oha 1.16.0.

All targets serve the same Nest application; only the HTTP adapter and runtime change. Results from one machine are comparative, not absolute.

Regenerate from the repository root with `bun run bench`.

## oha

Throughput, median requests per second:

| Scenario | bun | node | express | fastify |
| --- | ---: | ---: | ---: | ---: |
| plaintext | 14,163 | 9,776 | 7,786 | 11,947 |
| json | 14,060 | 9,654 | 7,992 | 11,788 |
| query | 11,044 | 8,647 | 7,586 | 10,689 |
| params | 13,649 | 9,059 | 7,544 | 11,269 |
| post | 11,182 | 7,268 | 6,323 | 9,540 |
| pipeline | 10,847 | 7,211 | 6,343 | 9,193 |
| error | 11,657 | 7,980 | 6,539 | 9,845 |
| cors | 14,170 | 9,365 | 11,123 | 12,014 |

Latency, median p99 in milliseconds:

| Scenario | bun | node | express | fastify |
| --- | ---: | ---: | ---: | ---: |
| plaintext | 10.24 | 16.00 | 18.90 | 11.07 |
| json | 11.01 | 17.95 | 19.25 | 12.85 |
| query | 14.36 | 17.65 | 17.41 | 13.92 |
| params | 11.08 | 17.53 | 16.70 | 13.72 |
| post | 13.06 | 20.99 | 22.61 | 14.36 |
| pipeline | 13.20 | 21.12 | 24.36 | 14.19 |
| error | 12.69 | 18.91 | 21.71 | 14.38 |
| cors | 10.84 | 14.99 | 11.31 | 12.67 |

Errors, median count (`error` and a 418 are expected there):

| Scenario | bun | node | express | fastify |
| --- | ---: | ---: | ---: | ---: |
| plaintext | 0 | 0 | 0 | 0 |
| json | 0 | 0 | 0 | 0 |
| query | 0 | 0 | 0 | 0 |
| params | 0 | 0 | 0 | 0 |
| post | 0 | 0 | 0 | 0 |
| pipeline | 0 | 0 | 0 | 0 |
| error | 58,221 | 39,820 | 32,611 | 49,149 |
| cors | 0 | 0 | 0 | 0 |

CPU, median percent of one core:

| Scenario | bun | node | express | fastify |
| --- | ---: | ---: | ---: | ---: |
| plaintext | 102.0 | 118.2 | 99.6 | 99.7 |
| json | 102.7 | 117.0 | 100.2 | 99.2 |
| query | 102.6 | 115.1 | 99.8 | 99.3 |
| params | 102.6 | 117.0 | 99.8 | 99.3 |
| post | 103.4 | 114.6 | 100.2 | 99.3 |
| pipeline | 103.9 | 113.9 | 100.0 | 99.4 |
| error | 102.3 | 114.2 | 99.6 | 99.2 |
| cors | 101.8 | 106.9 | 99.5 | 99.0 |

CPU cost, median milliseconds per request:

| Scenario | bun | node | express | fastify |
| --- | ---: | ---: | ---: | ---: |
| plaintext | 0.073 | 0.122 | 0.130 | 0.084 |
| json | 0.074 | 0.122 | 0.126 | 0.085 |
| query | 0.094 | 0.134 | 0.133 | 0.094 |
| params | 0.076 | 0.130 | 0.133 | 0.089 |
| post | 0.093 | 0.160 | 0.160 | 0.105 |
| pipeline | 0.097 | 0.159 | 0.160 | 0.109 |
| error | 0.089 | 0.144 | 0.154 | 0.102 |
| cors | 0.072 | 0.115 | 0.090 | 0.083 |

Memory, median mean RSS in mebibytes:

| Scenario | bun | node | express | fastify |
| --- | ---: | ---: | ---: | ---: |
| plaintext | 98.4 | 243.3 | 143.5 | 146.7 |
| json | 95.0 | 238.5 | 151.4 | 147.9 |
| query | 94.8 | 246.1 | 150.4 | 150.9 |
| params | 94.9 | 243.4 | 171.8 | 177.6 |
| post | 97.0 | 247.5 | 181.9 | 179.8 |
| pipeline | 101.8 | 255.7 | 186.2 | 185.2 |
| error | 100.8 | 250.7 | 186.3 | 186.7 |
| cors | 99.9 | 246.3 | 187.5 | 186.7 |

Memory, median peak RSS in mebibytes:

| Scenario | bun | node | express | fastify |
| --- | ---: | ---: | ---: | ---: |
| plaintext | 100.1 | 249.2 | 143.9 | 146.9 |
| json | 96.3 | 239.4 | 151.8 | 147.9 |
| query | 95.7 | 246.5 | 150.9 | 151.0 |
| params | 95.2 | 243.6 | 174.7 | 177.6 |
| post | 97.2 | 251.7 | 182.0 | 179.8 |
| pipeline | 102.9 | 256.0 | 186.3 | 185.3 |
| error | 101.7 | 250.8 | 186.3 | 186.7 |
| cors | 100.4 | 247.5 | 187.6 | 186.9 |

