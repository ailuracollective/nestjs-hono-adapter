# NestJS adapter benchmark

Measured 2026-11-17T01:05:44.348Z on AMD Ryzen 5 7535HS with Radeon Graphics with 12 logical cores.
Bun 1.4.4, Node 26.13.0.
Connections 100, duration 5s, warmup 3s, 3 runs, medians reported.
Tools: oha 1.17.0.

All targets serve the same pair of Nest applications: a base app without Inertia, and an Inertia app with the React, Vue and Svelte SSR scopes. Only the HTTP adapter and runtime change. Results from one machine are comparative, not absolute.

Regenerate from the repository root with `bun run bench`.

## oha

Throughput, median requests per second:

| Scenario | bun | node | express | fastify |
| --- | ---: | ---: | ---: | ---: |
| plaintext | 14,099 | 12,049 | 10,892 | 13,923 |
| json | 13,425 | 11,908 | 11,265 | 13,694 |
| query | 12,223 | 11,406 | 10,531 | 12,176 |
| params | 13,051 | 11,272 | 10,430 | 12,806 |
| post | 11,203 | 9,174 | 8,794 | 10,831 |
| pipeline | 10,989 | 9,286 | 9,013 | 10,452 |
| pipes | 12,945 | 10,815 | 10,085 | 12,437 |
| middleware | 12,567 | 9,607 | 10,715 | 12,383 |
| stream | 9,531 | 5,517 | 8,694 | 8,165 |
| inertia | 6,931 | 4,876 | 5,655 | 7,109 |
| inertia-html | 7,173 | 5,522 | 5,655 | 7,059 |
| inertia-react | 4,850 | 3,570 | 3,504 | 4,341 |
| inertia-react-form | 4,361 | 3,283 | 3,337 | 3,857 |
| inertia-react-submit | 7,175 | 5,076 | 5,645 | 6,443 |
| inertia-vue | 3,550 | 2,052 | 2,415 | 2,695 |
| inertia-vue-form | 3,020 | 1,609 | 2,109 | 2,377 |
| inertia-vue-submit | 7,063 | 4,755 | 5,639 | 6,554 |
| inertia-svelte | 5,566 | 4,064 | 4,486 | 5,492 |
| inertia-svelte-form | 5,681 | 4,098 | 4,510 | 5,550 |
| inertia-svelte-submit | 6,842 | 4,573 | 5,601 | 6,444 |
| error | 12,037 | 8,258 | 9,142 | 10,912 |
| cors | 15,588 | 10,149 | 13,177 | 14,104 |

Latency, median p99 in milliseconds:

| Scenario | bun | node | express | fastify |
| --- | ---: | ---: | ---: | ---: |
| plaintext | 12.53 | 10.56 | 13.16 | 8.50 |
| json | 12.53 | 10.31 | 11.13 | 8.82 |
| query | 13.88 | 11.26 | 11.95 | 10.37 |
| params | 14.01 | 11.74 | 13.64 | 9.24 |
| post | 14.86 | 14.44 | 13.78 | 10.96 |
| pipeline | 15.26 | 14.38 | 14.21 | 11.80 |
| pipes | 13.96 | 12.35 | 12.25 | 10.41 |
| middleware | 13.75 | 17.48 | 12.01 | 9.83 |
| stream | 17.03 | 21.76 | 16.56 | 18.14 |
| inertia | 19.66 | 30.84 | 24.57 | 22.98 |
| inertia-html | 18.95 | 28.69 | 24.38 | 19.78 |
| inertia-react | 25.57 | 40.82 | 39.72 | 34.08 |
| inertia-react-form | 26.98 | 53.77 | 42.38 | 38.67 |
| inertia-react-submit | 21.01 | 36.90 | 24.80 | 20.38 |
| inertia-vue | 33.34 | 94.10 | 73.25 | 67.47 |
| inertia-vue-form | 39.51 | 269.38 | 76.16 | 76.62 |
| inertia-vue-submit | 23.43 | 40.58 | 22.99 | 19.90 |
| inertia-svelte | 23.39 | 37.82 | 27.74 | 22.58 |
| inertia-svelte-form | 23.73 | 37.02 | 30.16 | 22.20 |
| inertia-svelte-submit | 26.67 | 42.44 | 24.75 | 19.78 |
| error | 13.39 | 16.85 | 13.88 | 11.53 |
| cors | 11.07 | 13.15 | 9.69 | 8.99 |

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
| inertia-react | 0 | 0 | 0 | 0 |
| inertia-react-form | 0 | 0 | 0 | 0 |
| inertia-react-submit | 0 | 0 | 0 | 0 |
| inertia-vue | 0 | 0 | 0 | 0 |
| inertia-vue-form | 0 | 0 | 0 | 0 |
| inertia-vue-submit | 0 | 0 | 0 | 0 |
| inertia-svelte | 0 | 0 | 0 | 0 |
| inertia-svelte-form | 0 | 0 | 0 | 0 |
| inertia-svelte-submit | 0 | 0 | 0 | 0 |
| error | 60,114 | 41,214 | 45,631 | 54,491 |
| cors | 0 | 0 | 0 | 0 |

CPU, median percent of one core:

| Scenario | bun | node | express | fastify |
| --- | ---: | ---: | ---: | ---: |
| plaintext | 102.3 | 99.7 | 99.9 | 99.7 |
| json | 102.5 | 99.9 | 99.9 | 99.7 |
| query | 102.6 | 99.8 | 99.8 | 99.8 |
| params | 102.9 | 99.8 | 100.6 | 99.5 |
| post | 102.8 | 100.2 | 100.4 | 99.8 |
| pipeline | 104.0 | 102.9 | 99.9 | 99.8 |
| pipes | 102.7 | 100.2 | 100.1 | 99.5 |
| middleware | 103.1 | 117.2 | 99.8 | 99.7 |
| stream | 103.0 | 104.1 | 111.5 | 112.4 |
| inertia | 105.3 | 120.9 | 112.5 | 110.2 |
| inertia-html | 105.7 | 120.7 | 111.8 | 108.5 |
| inertia-react | 105.8 | 114.2 | 108.6 | 106.3 |
| inertia-react-form | 108.7 | 117.2 | 111.3 | 111.2 |
| inertia-react-submit | 104.5 | 120.9 | 111.0 | 107.9 |
| inertia-vue | 105.8 | 136.4 | 131.9 | 134.8 |
| inertia-vue-form | 108.4 | 131.1 | 128.9 | 128.3 |
| inertia-vue-submit | 104.7 | 121.3 | 110.9 | 107.3 |
| inertia-svelte | 105.2 | 118.9 | 108.4 | 107.3 |
| inertia-svelte-form | 105.2 | 118.7 | 110.1 | 107.3 |
| inertia-svelte-submit | 106.3 | 120.3 | 110.7 | 107.5 |
| error | 102.5 | 101.6 | 100.8 | 100.3 |
| cors | 102.1 | 100.0 | 99.9 | 99.9 |

CPU cost, median milliseconds per request:

| Scenario | bun | node | express | fastify |
| --- | ---: | ---: | ---: | ---: |
| plaintext | 0.073 | 0.083 | 0.092 | 0.072 |
| json | 0.077 | 0.085 | 0.089 | 0.074 |
| query | 0.085 | 0.088 | 0.096 | 0.083 |
| params | 0.079 | 0.089 | 0.097 | 0.078 |
| post | 0.092 | 0.110 | 0.115 | 0.093 |
| pipeline | 0.095 | 0.112 | 0.112 | 0.096 |
| pipes | 0.080 | 0.093 | 0.100 | 0.081 |
| middleware | 0.083 | 0.123 | 0.094 | 0.081 |
| stream | 0.109 | 0.190 | 0.129 | 0.138 |
| inertia | 0.153 | 0.250 | 0.200 | 0.156 |
| inertia-html | 0.148 | 0.220 | 0.197 | 0.155 |
| inertia-react | 0.220 | 0.322 | 0.313 | 0.246 |
| inertia-react-form | 0.248 | 0.360 | 0.335 | 0.288 |
| inertia-react-submit | 0.147 | 0.240 | 0.199 | 0.169 |
| inertia-vue | 0.305 | 0.673 | 0.561 | 0.503 |
| inertia-vue-form | 0.366 | 0.832 | 0.619 | 0.546 |
| inertia-vue-submit | 0.149 | 0.257 | 0.198 | 0.167 |
| inertia-svelte | 0.190 | 0.299 | 0.243 | 0.197 |
| inertia-svelte-form | 0.186 | 0.292 | 0.243 | 0.195 |
| inertia-svelte-submit | 0.156 | 0.270 | 0.199 | 0.168 |
| error | 0.086 | 0.123 | 0.111 | 0.092 |
| cors | 0.066 | 0.099 | 0.076 | 0.071 |

Memory, median mean RSS in mebibytes:

| Scenario | bun | node | express | fastify |
| --- | ---: | ---: | ---: | ---: |
| plaintext | 106.1 | 189.2 | 140.1 | 144.4 |
| json | 101.2 | 189.5 | 145.9 | 145.6 |
| query | 101.7 | 190.8 | 152.1 | 147.8 |
| params | 100.7 | 190.2 | 147.3 | 173.9 |
| post | 102.2 | 192.2 | 171.8 | 176.3 |
| pipeline | 107.3 | 156.7 | 178.9 | 183.9 |
| pipes | 105.6 | 164.3 | 179.0 | 184.1 |
| middleware | 106.6 | 298.6 | 179.8 | 182.5 |
| stream | 110.1 | 298.4 | 242.7 | 260.3 |
| inertia | 109.0 | 323.9 | 253.2 | 266.9 |
| inertia-html | 110.2 | 322.1 | 248.5 | 266.0 |
| inertia-react | 139.4 | 367.8 | 286.5 | 293.1 |
| inertia-react-form | 141.6 | 373.7 | 315.0 | 314.7 |
| inertia-react-submit | 140.3 | 354.3 | 301.4 | 305.8 |
| inertia-vue | 159.5 | 407.4 | 353.7 | 368.2 |
| inertia-vue-form | 160.9 | 405.3 | 346.9 | 379.7 |
| inertia-vue-submit | 153.5 | 384.9 | 325.0 | 335.2 |
| inertia-svelte | 179.5 | 405.7 | 345.0 | 345.8 |
| inertia-svelte-form | 171.4 | 405.3 | 341.8 | 348.0 |
| inertia-svelte-submit | 156.7 | 393.9 | 330.0 | 338.1 |
| error | 103.8 | 152.8 | 118.1 | 120.1 |
| cors | 103.8 | 166.7 | 126.1 | 128.1 |

Memory, median peak RSS in mebibytes:

| Scenario | bun | node | express | fastify |
| --- | ---: | ---: | ---: | ---: |
| plaintext | 106.5 | 189.4 | 140.7 | 144.4 |
| json | 101.8 | 189.5 | 146.6 | 145.6 |
| query | 102.2 | 190.8 | 152.2 | 147.8 |
| params | 101.2 | 190.2 | 147.4 | 173.9 |
| post | 103.4 | 192.2 | 172.0 | 176.4 |
| pipeline | 107.9 | 164.6 | 178.9 | 183.9 |
| pipes | 107.3 | 164.3 | 179.3 | 184.1 |
| middleware | 107.2 | 299.2 | 179.8 | 182.5 |
| stream | 111.4 | 301.0 | 242.9 | 260.3 |
| inertia | 109.2 | 330.9 | 257.8 | 274.5 |
| inertia-html | 110.7 | 324.4 | 254.4 | 269.0 |
| inertia-react | 146.8 | 369.8 | 302.3 | 314.3 |
| inertia-react-form | 146.7 | 379.7 | 318.0 | 323.5 |
| inertia-react-submit | 142.1 | 372.4 | 317.3 | 323.5 |
| inertia-vue | 163.8 | 436.3 | 372.7 | 375.9 |
| inertia-vue-form | 164.3 | 405.3 | 356.2 | 380.7 |
| inertia-vue-submit | 155.4 | 388.6 | 326.1 | 335.2 |
| inertia-svelte | 185.9 | 407.9 | 349.2 | 353.6 |
| inertia-svelte-form | 180.5 | 410.1 | 343.8 | 354.4 |
| inertia-svelte-submit | 160.0 | 394.9 | 331.4 | 341.9 |
| error | 104.6 | 152.8 | 118.6 | 120.1 |
| cors | 105.0 | 166.7 | 126.1 | 128.1 |

