# NestJS adapter benchmark

Measured 2026-11-16T22:40:52.435Z on AMD Ryzen 5 7535HS with Radeon Graphics with 12 logical cores.
Bun 1.4.4, Node 26.13.0.
Connections 50, duration 2s, warmup 1s, 3 runs, medians reported.
Tools: oha 1.17.0.

All targets serve the same pair of Nest applications: a base app without Inertia, and an Inertia app with the React, Vue and Svelte SSR scopes. Only the HTTP adapter and runtime change. Results from one machine are comparative, not absolute.

Regenerate from the repository root with `bun run bench`.

## oha

Throughput, median requests per second:

| Scenario | bun | node | express | fastify |
| --- | ---: | ---: | ---: | ---: |
| plaintext | 14,474 | 7,643 | 11,597 | 13,795 |
| json | 14,086 | 7,073 | 11,281 | 13,633 |
| query | 11,909 | 7,062 | 10,620 | 12,769 |
| params | 12,759 | 7,359 | 10,641 | 12,814 |
| post | 10,992 | 7,435 | 8,852 | 10,765 |
| pipeline | 10,565 | 6,395 | 9,113 | 10,404 |
| pipes | 12,635 | 7,149 | 10,240 | 12,373 |
| middleware | 11,234 | 6,604 | 10,829 | 12,917 |
| stream | 8,950 | 4,026 | 8,856 | 8,304 |
| inertia | 5,334 | 3,265 | 5,491 | 7,378 |
| inertia-html | 5,446 | 3,794 | 5,584 | 7,122 |
| error | 11,665 | 6,205 | 9,094 | 10,886 |
| cors | 15,303 | 10,438 | 14,084 | 13,867 |

Latency, median p99 in milliseconds:

| Scenario | bun | node | express | fastify |
| --- | ---: | ---: | ---: | ---: |
| plaintext | 6.60 | 13.86 | 8.33 | 6.94 |
| json | 6.79 | 16.25 | 8.56 | 7.08 |
| query | 7.94 | 14.79 | 9.11 | 7.57 |
| params | 7.44 | 13.50 | 9.06 | 7.42 |
| post | 8.62 | 12.90 | 10.91 | 8.91 |
| pipeline | 8.90 | 15.98 | 10.61 | 9.23 |
| pipes | 7.52 | 13.94 | 9.45 | 7.76 |
| middleware | 8.38 | 15.10 | 8.88 | 7.48 |
| stream | 10.85 | 21.29 | 10.80 | 11.33 |
| inertia | 18.67 | 31.06 | 16.67 | 11.71 |
| inertia-html | 18.59 | 26.39 | 17.10 | 12.98 |
| error | 8.17 | 16.24 | 10.61 | 8.90 |
| cors | 6.30 | 9.24 | 6.83 | 6.93 |

Errors, median count (`error` and a 418 are expected there):

| Scenario | bun | node | express | fastify |
| --- | ---: | ---: | ---: | ---: |
| plaintext | 0 | 0 | 0 | 0 |
| json | 0 | 0 | 0 | 0 |
| query | 0 | 0 | 0 | 0 |
| params | 0 | 0 | 0 | 0 |
| post | 0 | 0 | 0 | 0 |
| pipeline | 0 | 0 | 0 | 0 |
| pipes | 0 | 0 | 0 | 0 |
| middleware | 0 | 0 | 0 | 0 |
| stream | 0 | 0 | 0 | 0 |
| inertia | 0 | 0 | 0 | 0 |
| inertia-html | 0 | 0 | 0 | 0 |
| error | 23,313 | 12,370 | 18,156 | 21,743 |
| cors | 0 | 0 | 0 | 0 |

CPU, median percent of one core:

| Scenario | bun | node | express | fastify |
| --- | ---: | ---: | ---: | ---: |
| plaintext | 102.3 | 122.0 | 100.1 | 99.9 |
| json | 102.0 | 121.9 | 100.0 | 99.5 |
| query | 103.0 | 121.5 | 100.6 | 100.0 |
| params | 102.4 | 121.0 | 100.1 | 100.0 |
| post | 102.5 | 116.1 | 101.6 | 100.1 |
| pipeline | 104.6 | 120.5 | 100.1 | 99.6 |
| pipes | 102.5 | 120.0 | 100.1 | 99.9 |
| middleware | 103.4 | 122.6 | 100.1 | 100.0 |
| stream | 106.5 | 120.2 | 111.1 | 113.0 |
| inertia | 106.2 | 135.5 | 120.0 | 110.0 |
| inertia-html | 106.2 | 127.1 | 116.2 | 108.6 |
| error | 102.5 | 121.0 | 99.6 | 100.0 |
| cors | 102.8 | 106.5 | 100.0 | 99.4 |

CPU cost, median milliseconds per request:

| Scenario | bun | node | express | fastify |
| --- | ---: | ---: | ---: | ---: |
| plaintext | 0.072 | 0.161 | 0.087 | 0.073 |
| json | 0.073 | 0.174 | 0.089 | 0.074 |
| query | 0.087 | 0.174 | 0.096 | 0.079 |
| params | 0.081 | 0.167 | 0.096 | 0.079 |
| post | 0.094 | 0.158 | 0.116 | 0.094 |
| pipeline | 0.100 | 0.188 | 0.111 | 0.097 |
| pipes | 0.082 | 0.170 | 0.099 | 0.081 |
| middleware | 0.093 | 0.187 | 0.093 | 0.079 |
| stream | 0.120 | 0.296 | 0.126 | 0.135 |
| inertia | 0.200 | 0.408 | 0.229 | 0.151 |
| inertia-html | 0.200 | 0.339 | 0.210 | 0.155 |
| error | 0.089 | 0.204 | 0.110 | 0.093 |
| cors | 0.068 | 0.103 | 0.072 | 0.073 |

Memory, median mean RSS in mebibytes:

| Scenario | bun | node | express | fastify |
| --- | ---: | ---: | ---: | ---: |
| plaintext | 106.5 | 322.0 | 137.2 | 142.6 |
| json | 107.9 | 330.6 | 139.4 | 142.6 |
| query | 102.7 | 330.3 | 142.1 | 143.7 |
| params | 103.1 | 326.1 | 145.7 | 145.7 |
| post | 103.2 | 296.8 | 152.7 | 147.7 |
| pipeline | 108.1 | 331.4 | 153.7 | 152.0 |
| pipes | 107.4 | 342.1 | 152.4 | 153.1 |
| middleware | 108.1 | 340.5 | 151.6 | 174.9 |
| stream | 112.3 | 347.4 | 237.0 | 260.8 |
| inertia | 120.8 | 351.2 | 254.6 | 254.0 |
| inertia-html | 119.9 | 347.2 | 246.0 | 256.3 |
| error | 110.2 | 324.9 | 224.1 | 200.8 |
| cors | 110.8 | 336.8 | 203.2 | 168.4 |

Memory, median peak RSS in mebibytes:

| Scenario | bun | node | express | fastify |
| --- | ---: | ---: | ---: | ---: |
| plaintext | 107.7 | 328.9 | 137.5 | 142.6 |
| json | 108.3 | 330.8 | 139.6 | 142.7 |
| query | 103.6 | 330.7 | 142.3 | 143.8 |
| params | 103.5 | 326.3 | 146.1 | 145.7 |
| post | 104.1 | 328.3 | 153.0 | 147.8 |
| pipeline | 109.6 | 336.6 | 153.7 | 152.1 |
| pipes | 107.7 | 342.6 | 152.4 | 153.1 |
| middleware | 108.3 | 342.8 | 152.9 | 174.9 |
| stream | 117.9 | 347.8 | 237.1 | 261.2 |
| inertia | 122.5 | 353.1 | 255.0 | 260.5 |
| inertia-html | 121.2 | 353.4 | 254.5 | 265.9 |
| error | 111.3 | 334.1 | 224.1 | 200.8 |
| cors | 111.9 | 336.8 | 224.3 | 168.4 |

