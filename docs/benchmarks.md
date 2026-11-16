# NestJS adapter benchmark

Measured 2026-11-16T09:54:56.013Z on AMD Ryzen 5 7535HS with Radeon Graphics with 12 logical cores.
Bun 1.4.4, Node 26.13.0.
Connections 100, duration 5s, warmup 3s, 3 runs, medians reported.
Tools: oha 1.17.0.

All targets serve the same pair of Nest applications: a base app without Inertia, and an Inertia app with the React, Vue and Svelte SSR scopes. Only the HTTP adapter and runtime change. Results from one machine are comparative, not absolute.

Regenerate from the repository root with `bun run bench`.

## oha

Throughput, median requests per second:

| Scenario | bun | node | express | fastify |
| --- | ---: | ---: | ---: | ---: |
| plaintext | 13,174 | 7,166 | 9,839 | 14,081 |
| json | 13,519 | 7,409 | 9,742 | 14,129 |
| query | 11,811 | 6,953 | 9,333 | 13,453 |
| params | 12,611 | 7,195 | 9,218 | 13,425 |
| post | 10,847 | 7,370 | 8,022 | 11,092 |
| pipeline | 10,481 | 6,347 | 8,187 | 10,831 |
| inertia | 5,305 | 3,490 | 5,022 | 7,231 |
| inertia-html | 5,499 | 3,887 | 5,046 | 7,174 |
| inertia-react | 3,951 | 2,626 | 3,240 | 4,289 |
| inertia-react-form | 3,581 | 2,452 | 3,048 | 3,912 |
| inertia-react-submit | 5,470 | 3,898 | 5,368 | 6,584 |
| inertia-vue | 3,071 | 1,924 | 2,272 | 2,671 |
| inertia-vue-form | 2,698 | 1,741 | 2,040 | 2,388 |
| inertia-vue-submit | 5,477 | 3,994 | 5,360 | 6,548 |
| inertia-svelte | 4,406 | 3,158 | 4,090 | 5,565 |
| inertia-svelte-form | 4,447 | 3,263 | 4,040 | 5,535 |
| inertia-svelte-submit | 5,450 | 4,003 | 5,196 | 6,541 |
| error | 11,689 | 6,386 | 8,273 | 11,124 |
| cors | 15,348 | 10,525 | 14,669 | 15,146 |

Latency, median p99 in milliseconds:

| Scenario | bun | node | express | fastify |
| --- | ---: | ---: | ---: | ---: |
| plaintext | 12.99 | 25.48 | 12.43 | 9.35 |
| json | 12.81 | 24.22 | 13.15 | 9.03 |
| query | 13.39 | 25.62 | 13.14 | 9.13 |
| params | 13.01 | 24.74 | 12.87 | 9.08 |
| post | 14.59 | 23.22 | 15.01 | 10.56 |
| pipeline | 14.15 | 27.40 | 14.66 | 12.96 |
| inertia | 24.69 | 54.61 | 29.11 | 18.38 |
| inertia-html | 23.01 | 43.45 | 27.58 | 19.01 |
| inertia-react | 31.33 | 69.89 | 48.81 | 31.61 |
| inertia-react-form | 37.97 | 68.76 | 49.64 | 37.37 |
| inertia-react-submit | 25.43 | 45.92 | 30.02 | 19.18 |
| inertia-vue | 38.84 | 85.00 | 70.17 | 70.47 |
| inertia-vue-form | 52.11 | 120.64 | 80.81 | 77.18 |
| inertia-vue-submit | 22.64 | 44.72 | 26.91 | 20.74 |
| inertia-svelte | 30.43 | 53.63 | 31.15 | 24.25 |
| inertia-svelte-form | 27.58 | 48.21 | 34.17 | 23.86 |
| inertia-svelte-submit | 24.15 | 45.13 | 28.99 | 19.26 |
| error | 14.16 | 26.47 | 14.87 | 10.46 |
| cors | 11.53 | 13.30 | 8.36 | 8.23 |

Errors, median count (`error` and a 418 are expected there):

| Scenario | bun | node | express | fastify |
| --- | ---: | ---: | ---: | ---: |
| plaintext | 0 | 0 | 0 | 0 |
| json | 0 | 0 | 0 | 0 |
| query | 0 | 0 | 0 | 0 |
| params | 0 | 0 | 0 | 0 |
| post | 0 | 0 | 0 | 0 |
| pipeline | 0 | 0 | 0 | 0 |
| inertia | 0 | 0 | 0 | 0 |
| inertia-html | 0 | 0 | 0 | 0 |
| inertia-react | 0 | 0 | 0 | 0 |
| inertia-react-form | 0 | 0 | 0 | 0 |
| inertia-react-submit | 0 | 0 | 0 | 0 |
| inertia-vue | 0 | 0 | 0 | 0 |
| inertia-vue-form | 0 | 0 | 0 | 0 |
| inertia-vue-submit | 0 | 0 | 0 | 0 |
| inertia-svelte | 0 | 0 | 0 | 0 |
| inertia-svelte-form | 0 | 0 | 0 | 0 |
| inertia-svelte-submit | 0 | 0 | 0 | 0 |
| error | 58,369 | 31,846 | 41,282 | 55,551 |
| cors | 0 | 0 | 0 | 0 |

CPU, median percent of one core:

| Scenario | bun | node | express | fastify |
| --- | ---: | ---: | ---: | ---: |
| plaintext | 102.1 | 121.6 | 100.0 | 99.8 |
| json | 102.9 | 120.7 | 100.0 | 99.6 |
| query | 102.3 | 120.2 | 100.2 | 99.7 |
| params | 102.9 | 120.8 | 100.1 | 99.7 |
| post | 103.2 | 115.6 | 100.5 | 99.8 |
| pipeline | 104.6 | 119.0 | 100.1 | 99.8 |
| inertia | 106.2 | 127.3 | 114.1 | 109.8 |
| inertia-html | 106.1 | 127.2 | 113.3 | 108.8 |
| inertia-react | 105.8 | 120.1 | 109.8 | 106.6 |
| inertia-react-form | 108.0 | 122.2 | 112.0 | 110.1 |
| inertia-react-submit | 106.8 | 126.3 | 114.7 | 108.1 |
| inertia-vue | 108.6 | 137.1 | 131.2 | 132.5 |
| inertia-vue-form | 109.0 | 133.9 | 127.4 | 128.0 |
| inertia-vue-submit | 106.3 | 125.8 | 113.9 | 108.3 |
| inertia-svelte | 105.4 | 125.0 | 111.3 | 107.3 |
| inertia-svelte-form | 105.4 | 124.7 | 111.2 | 107.3 |
| inertia-svelte-submit | 105.6 | 125.9 | 113.7 | 108.3 |
| error | 102.5 | 118.3 | 101.1 | 100.8 |
| cors | 102.3 | 106.2 | 99.9 | 99.7 |

CPU cost, median milliseconds per request:

| Scenario | bun | node | express | fastify |
| --- | ---: | ---: | ---: | ---: |
| plaintext | 0.078 | 0.170 | 0.102 | 0.072 |
| json | 0.077 | 0.165 | 0.103 | 0.071 |
| query | 0.087 | 0.174 | 0.108 | 0.075 |
| params | 0.082 | 0.169 | 0.109 | 0.075 |
| post | 0.096 | 0.158 | 0.126 | 0.091 |
| pipeline | 0.101 | 0.188 | 0.124 | 0.093 |
| inertia | 0.201 | 0.368 | 0.228 | 0.153 |
| inertia-html | 0.194 | 0.330 | 0.227 | 0.153 |
| inertia-react | 0.277 | 0.463 | 0.340 | 0.249 |
| inertia-react-form | 0.304 | 0.504 | 0.371 | 0.286 |
| inertia-react-submit | 0.197 | 0.324 | 0.215 | 0.166 |
| inertia-vue | 0.357 | 0.722 | 0.583 | 0.502 |
| inertia-vue-form | 0.408 | 0.781 | 0.632 | 0.542 |
| inertia-vue-submit | 0.194 | 0.317 | 0.214 | 0.166 |
| inertia-svelte | 0.242 | 0.400 | 0.272 | 0.196 |
| inertia-svelte-form | 0.239 | 0.383 | 0.278 | 0.196 |
| inertia-svelte-submit | 0.196 | 0.321 | 0.223 | 0.167 |
| error | 0.088 | 0.187 | 0.123 | 0.091 |
| cors | 0.067 | 0.101 | 0.069 | 0.066 |

Memory, median mean RSS in mebibytes:

| Scenario | bun | node | express | fastify |
| --- | ---: | ---: | ---: | ---: |
| plaintext | 106.0 | 334.7 | 142.3 | 142.7 |
| json | 101.0 | 333.6 | 151.8 | 143.7 |
| query | 101.2 | 335.3 | 146.1 | 146.1 |
| params | 101.4 | 339.1 | 145.6 | 172.1 |
| post | 102.3 | 307.6 | 173.5 | 175.1 |
| pipeline | 105.6 | 346.9 | 178.8 | 183.3 |
| inertia | 119.5 | 364.4 | 263.7 | 268.1 |
| inertia-html | 118.4 | 373.3 | 258.2 | 262.9 |
| inertia-react | 144.3 | 402.9 | 306.6 | 314.8 |
| inertia-react-form | 148.4 | 406.8 | 316.0 | 324.8 |
| inertia-react-submit | 142.7 | 403.6 | 308.9 | 308.7 |
| inertia-vue | 164.2 | 433.9 | 363.4 | 387.1 |
| inertia-vue-form | 166.1 | 436.3 | 363.7 | 384.3 |
| inertia-vue-submit | 158.4 | 415.5 | 344.8 | 337.8 |
| inertia-svelte | 179.2 | 446.1 | 343.9 | 354.9 |
| inertia-svelte-form | 172.9 | 443.9 | 341.9 | 348.2 |
| inertia-svelte-submit | 159.4 | 443.8 | 337.3 | 344.6 |
| error | 102.1 | 336.0 | 119.8 | 121.6 |
| cors | 101.3 | 298.3 | 126.6 | 130.0 |

Memory, median peak RSS in mebibytes:

| Scenario | bun | node | express | fastify |
| --- | ---: | ---: | ---: | ---: |
| plaintext | 106.6 | 341.1 | 143.1 | 142.8 |
| json | 101.5 | 334.6 | 152.4 | 143.8 |
| query | 101.9 | 336.1 | 149.1 | 146.1 |
| params | 101.6 | 342.5 | 146.0 | 172.1 |
| post | 103.2 | 307.6 | 173.7 | 175.1 |
| pipeline | 106.6 | 347.6 | 179.1 | 183.3 |
| inertia | 120.3 | 375.5 | 263.9 | 275.2 |
| inertia-html | 119.4 | 378.8 | 260.4 | 268.6 |
| inertia-react | 148.7 | 403.0 | 307.3 | 316.3 |
| inertia-react-form | 150.8 | 407.6 | 319.8 | 328.2 |
| inertia-react-submit | 145.7 | 403.6 | 315.2 | 325.0 |
| inertia-vue | 166.8 | 435.8 | 366.3 | 392.1 |
| inertia-vue-form | 174.1 | 443.2 | 366.2 | 412.2 |
| inertia-vue-submit | 162.5 | 415.5 | 355.6 | 337.8 |
| inertia-svelte | 180.8 | 447.6 | 343.9 | 358.0 |
| inertia-svelte-form | 182.0 | 450.5 | 341.9 | 354.1 |
| inertia-svelte-submit | 160.5 | 443.8 | 341.2 | 345.1 |
| error | 102.9 | 337.2 | 127.1 | 121.6 |
| cors | 101.8 | 298.4 | 126.6 | 130.0 |

