# NestJS adapter benchmark

Measured 2026-11-16T08:57:32.522Z on AMD Ryzen 5 7535HS with Radeon Graphics with 12 logical cores.
Bun 1.4.4, Node 26.13.0.
Connections 100, duration 5s, warmup 3s, 3 runs, medians reported.
Tools: oha 1.17.0.

All targets serve the same Nest application; only the HTTP adapter and runtime change. Results from one machine are comparative, not absolute.

Regenerate from the repository root with `bun run bench`.

## oha

Throughput, median requests per second:

| Scenario | bun | node | express | fastify |
| --- | ---: | ---: | ---: | ---: |
| plaintext | 6,064 | 4,179 | 5,751 | 8,971 |
| json | 6,317 | 4,150 | 5,708 | 9,201 |
| query | 5,779 | 4,031 | 5,563 | 8,903 |
| params | 6,192 | 4,127 | 5,626 | 8,935 |
| post | 5,746 | 4,148 | 5,101 | 7,747 |
| pipeline | 6,270 | 4,162 | 5,628 | 8,902 |
| inertia | 5,036 | 3,224 | 5,001 | 6,939 |
| inertia-html | 5,282 | 3,645 | 4,974 | 6,843 |
| inertia-react | 3,855 | 2,503 | 3,266 | 4,232 |
| inertia-react-form | 3,548 | 2,295 | 3,015 | 3,809 |
| inertia-react-submit | 5,454 | 3,865 | 5,463 | 6,514 |
| inertia-vue | 3,018 | 1,913 | 2,198 | 2,640 |
| inertia-vue-form | 2,514 | 1,721 | 2,023 | 2,285 |
| inertia-vue-submit | 5,312 | 3,879 | 5,481 | 6,383 |
| inertia-svelte | 4,313 | 2,958 | 4,043 | 5,343 |
| inertia-svelte-form | 4,458 | 3,177 | 4,069 | 5,335 |
| inertia-svelte-submit | 5,503 | 3,650 | 5,440 | 6,175 |
| error | 5,781 | 3,843 | 5,073 | 6,914 |
| cors | 15,142 | 10,509 | 12,867 | 10,304 |

Latency, median p99 in milliseconds:

| Scenario | bun | node | express | fastify |
| --- | ---: | ---: | ---: | ---: |
| plaintext | 28.55 | 40.20 | 27.03 | 17.95 |
| json | 22.37 | 41.51 | 26.11 | 15.40 |
| query | 23.47 | 42.68 | 27.26 | 17.69 |
| params | 24.36 | 44.53 | 26.60 | 17.03 |
| post | 23.12 | 42.54 | 30.48 | 19.93 |
| pipeline | 20.93 | 40.40 | 27.24 | 17.27 |
| inertia | 24.85 | 54.55 | 29.80 | 20.34 |
| inertia-html | 24.10 | 47.03 | 31.02 | 21.17 |
| inertia-react | 34.70 | 72.12 | 46.87 | 35.19 |
| inertia-react-form | 36.75 | 68.48 | 52.54 | 40.02 |
| inertia-react-submit | 23.56 | 45.58 | 27.80 | 21.72 |
| inertia-vue | 42.66 | 97.33 | 80.39 | 60.76 |
| inertia-vue-form | 48.00 | 121.39 | 84.05 | 77.75 |
| inertia-vue-submit | 31.70 | 45.66 | 28.59 | 19.77 |
| inertia-svelte | 31.49 | 55.74 | 37.33 | 23.46 |
| inertia-svelte-form | 28.55 | 58.53 | 35.55 | 24.81 |
| inertia-svelte-submit | 26.81 | 47.96 | 26.77 | 22.94 |
| error | 24.02 | 44.81 | 29.15 | 18.45 |
| cors | 12.34 | 16.37 | 10.80 | 26.55 |

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
| error | 28,820 | 19,130 | 25,282 | 34,489 |
| cors | 0 | 0 | 0 | 0 |

CPU, median percent of one core:

| Scenario | bun | node | express | fastify |
| --- | ---: | ---: | ---: | ---: |
| plaintext | 105.9 | 129.7 | 112.9 | 107.0 |
| json | 107.3 | 128.9 | 113.1 | 106.8 |
| query | 107.1 | 127.2 | 112.7 | 106.4 |
| params | 109.6 | 128.1 | 112.5 | 106.4 |
| post | 107.9 | 125.4 | 111.7 | 106.4 |
| pipeline | 107.7 | 128.9 | 112.5 | 106.6 |
| inertia | 108.5 | 126.1 | 113.9 | 108.5 |
| inertia-html | 107.3 | 126.8 | 113.7 | 108.0 |
| inertia-react | 106.8 | 120.1 | 110.4 | 106.1 |
| inertia-react-form | 106.6 | 121.2 | 111.8 | 110.2 |
| inertia-react-submit | 106.4 | 125.9 | 114.4 | 107.8 |
| inertia-vue | 107.6 | 137.1 | 132.4 | 133.1 |
| inertia-vue-form | 110.4 | 133.6 | 128.7 | 126.4 |
| inertia-vue-submit | 105.5 | 124.5 | 115.1 | 107.9 |
| inertia-svelte | 105.3 | 126.9 | 111.3 | 107.0 |
| inertia-svelte-form | 105.6 | 124.5 | 111.3 | 106.9 |
| inertia-svelte-submit | 105.8 | 125.3 | 114.1 | 107.0 |
| error | 105.9 | 126.5 | 110.9 | 104.9 |
| cors | 102.7 | 105.2 | 99.6 | 101.8 |

CPU cost, median milliseconds per request:

| Scenario | bun | node | express | fastify |
| --- | ---: | ---: | ---: | ---: |
| plaintext | 0.177 | 0.313 | 0.198 | 0.120 |
| json | 0.172 | 0.314 | 0.199 | 0.116 |
| query | 0.187 | 0.320 | 0.204 | 0.120 |
| params | 0.178 | 0.313 | 0.201 | 0.121 |
| post | 0.189 | 0.303 | 0.221 | 0.138 |
| pipeline | 0.173 | 0.312 | 0.201 | 0.121 |
| inertia | 0.217 | 0.394 | 0.229 | 0.158 |
| inertia-html | 0.205 | 0.350 | 0.230 | 0.159 |
| inertia-react | 0.279 | 0.485 | 0.341 | 0.253 |
| inertia-react-form | 0.303 | 0.545 | 0.374 | 0.292 |
| inertia-react-submit | 0.196 | 0.328 | 0.211 | 0.167 |
| inertia-vue | 0.360 | 0.727 | 0.611 | 0.507 |
| inertia-vue-form | 0.436 | 0.789 | 0.645 | 0.560 |
| inertia-vue-submit | 0.200 | 0.324 | 0.211 | 0.170 |
| inertia-svelte | 0.246 | 0.436 | 0.277 | 0.202 |
| inertia-svelte-form | 0.239 | 0.396 | 0.276 | 0.203 |
| inertia-svelte-submit | 0.194 | 0.344 | 0.211 | 0.176 |
| error | 0.185 | 0.332 | 0.220 | 0.153 |
| cors | 0.068 | 0.101 | 0.078 | 0.100 |

Memory, median mean RSS in mebibytes:

| Scenario | bun | node | express | fastify |
| --- | ---: | ---: | ---: | ---: |
| plaintext | 118.1 | 364.6 | 257.1 | 262.3 |
| json | 114.8 | 364.2 | 251.3 | 260.4 |
| query | 113.8 | 371.2 | 254.2 | 260.8 |
| params | 113.5 | 374.0 | 252.6 | 260.0 |
| post | 114.7 | 340.3 | 258.4 | 262.2 |
| pipeline | 114.0 | 373.7 | 257.9 | 261.6 |
| inertia | 116.5 | 388.9 | 262.8 | 267.8 |
| inertia-html | 116.3 | 388.1 | 263.4 | 270.1 |
| inertia-react | 137.7 | 406.3 | 304.8 | 311.6 |
| inertia-react-form | 142.3 | 417.5 | 318.9 | 325.0 |
| inertia-react-submit | 139.2 | 380.3 | 301.2 | 316.6 |
| inertia-vue | 169.6 | 443.0 | 353.1 | 376.5 |
| inertia-vue-form | 161.5 | 421.5 | 354.1 | 392.2 |
| inertia-vue-submit | 154.9 | 405.9 | 328.4 | 358.8 |
| inertia-svelte | 179.8 | 773.9 | 335.6 | 346.2 |
| inertia-svelte-form | 170.3 | 460.1 | 339.0 | 345.8 |
| inertia-svelte-submit | 153.5 | 429.7 | 338.1 | 341.9 |
| error | 153.1 | 441.4 | 330.2 | 332.0 |
| cors | 149.2 | 411.0 | 327.3 | 261.0 |

Memory, median peak RSS in mebibytes:

| Scenario | bun | node | express | fastify |
| --- | ---: | ---: | ---: | ---: |
| plaintext | 119.3 | 369.8 | 260.4 | 268.5 |
| json | 115.0 | 364.4 | 251.6 | 261.0 |
| query | 114.4 | 373.3 | 255.3 | 261.4 |
| params | 115.9 | 378.2 | 255.1 | 262.4 |
| post | 115.1 | 377.8 | 260.0 | 262.4 |
| pipeline | 114.6 | 376.1 | 259.8 | 262.4 |
| inertia | 120.5 | 392.9 | 263.4 | 269.3 |
| inertia-html | 118.7 | 391.7 | 264.0 | 270.3 |
| inertia-react | 139.3 | 409.4 | 311.5 | 314.9 |
| inertia-react-form | 144.5 | 422.2 | 320.0 | 325.0 |
| inertia-react-submit | 141.7 | 386.2 | 301.3 | 322.5 |
| inertia-vue | 173.0 | 447.4 | 360.3 | 376.8 |
| inertia-vue-form | 167.3 | 435.6 | 365.6 | 396.7 |
| inertia-vue-submit | 156.4 | 405.9 | 353.5 | 372.2 |
| inertia-svelte | 181.0 | 1,013.1 | 342.6 | 352.0 |
| inertia-svelte-form | 178.9 | 460.4 | 340.7 | 347.6 |
| inertia-svelte-submit | 155.5 | 452.9 | 341.3 | 347.5 |
| error | 155.7 | 443.3 | 332.5 | 337.7 |
| cors | 152.1 | 450.2 | 327.3 | 333.9 |

