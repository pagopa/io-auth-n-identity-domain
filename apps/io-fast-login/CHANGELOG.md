# io-fast-login

## 4.2.1

### Patch Changes

- 2d376fc: Update internal client reference

## 4.2.0

### Minor Changes

- 6ac85b4: Update internal client

## 4.1.0

### Minor Changes

- 5fce960: Update Application Insights configuration

## 4.0.1

### Patch Changes

- [#IOPID-1642] Fix ReDOS vulnerability on SignatureInput header decoder [`#28`](https://github.com/pagopa/io-functions-fast-login/pull/28)

## 4.0.0

### Major Changes

> 13 November 2023

## 4.0.0-RELEASE

> 13 November 2023

- [#IOPID-276] verify nonce during fast login [`#27`](https://github.com/pagopa/io-functions-fast-login/pull/27)
- Bump version to 4.0.0 [skip ci] [`8fad02e`](https://github.com/pagopa/io-functions-fast-login/commit/8fad02e9951b2ca94b6e7f2925c9dcc3e0522b4e)

## 3.6.0

### Minor Changes

> 31 October 2023

## 3.6.0-RELEASE

> 31 October 2023

- [#IOPID-275] GenerateNonce API [`#25`](https://github.com/pagopa/io-functions-fast-login/pull/25)
- [#IOPID-274] changed success response code to 200 [`#26`](https://github.com/pagopa/io-functions-fast-login/pull/26)
- [#IOPID-274] add nonce/generate endpoint on openapi spec [`#24`](https://github.com/pagopa/io-functions-fast-login/pull/24)
- Bump version to 3.6.0 [skip ci] [`44dc893`](https://github.com/pagopa/io-functions-fast-login/commit/44dc893c05a08ea3c34c0fa3a37e9667914ffb5d)

## 3.5.0

### Minor Changes

> 18 October 2023

## 3.5.0-RELEASE

> 18 October 2023

- [#IOPID-984] unlock session endpoint [`#23`](https://github.com/pagopa/io-functions-fast-login/pull/23)
- Bump version to 3.5.0 [skip ci] [`1b72ad2`](https://github.com/pagopa/io-functions-fast-login/commit/1b72ad29dbcf36023c318faef248fc9c34da508b)

## 3.4.0

### Minor Changes

> 9 October 2023

## 3.4.0-RELEASE

> 9 October 2023

- [#IOPID-874] session state endpoint [`#22`](https://github.com/pagopa/io-functions-fast-login/pull/22)
- Bump version to 3.4.0 [skip ci] [`4fa3433`](https://github.com/pagopa/io-functions-fast-login/commit/4fa343326691c05bdcb7fb752147bdcb6023a9e7)

## 3.3.2

### Patch Changes

> 9 October 2023

## 3.3.2-RELEASE

> 9 October 2023

- Align HTTP error handling to @pagopa/handler-kit one [`#21`](https://github.com/pagopa/io-functions-fast-login/pull/21)
- Bump version to 3.3.2 [skip ci] [`8fe9359`](https://github.com/pagopa/io-functions-fast-login/commit/8fe93598ef66f54a8725602da83cc0bbe6f1a200)

## 3.3.1

### Patch Changes

> 9 October 2023

## 3.3.1-RELEASE

> 9 October 2023

- [#IOPID-858] updated openapi spec after io-backend release [`#20`](https://github.com/pagopa/io-functions-fast-login/pull/20)
- Bump version to 3.3.1 [skip ci] [`eacaf8b`](https://github.com/pagopa/io-functions-fast-login/commit/eacaf8b0b175430ecad080a0ed12e4b4bdb49648)

## 3.3.0

### Minor Changes

> 6 October 2023

## 3.3.0-RELEASE

> 6 October 2023

- [#IOPID-857] lock session endpoint [`#19`](https://github.com/pagopa/io-functions-fast-login/pull/19)
- Bump version to 3.3.0 [skip ci] [`0a4e806`](https://github.com/pagopa/io-functions-fast-login/commit/0a4e8060a1eb7f8fe83c3f869ec4806f802f97e3)

## 3.2.0

### Minor Changes

> 28 September 2023

## 3.2.0-RELEASE

> 28 September 2023

- added logout function [`#18`](https://github.com/pagopa/io-functions-fast-login/pull/18)
- [#IOPID-757] logout endpoint [`#17`](https://github.com/pagopa/io-functions-fast-login/pull/17)
- [#IOPID-428] Add new endpoints for IO-Web functionalities [`#13`](https://github.com/pagopa/io-functions-fast-login/pull/13)
- [#IOPID-757] introduced new RequiredBodyMiddleware [`7de0f2f`](https://github.com/pagopa/io-functions-fast-login/commit/7de0f2fe11f2b19d59ba63988c1d51d845088ab5)
- Bump version to 3.2.0 [skip ci] [`d8ce247`](https://github.com/pagopa/io-functions-fast-login/commit/d8ce247e1dfd6d78cfa7d6f6083e0afc65c4804c)
- [#IOPID-757] fromPredicate instead of switch case [`1c1dc8f`](https://github.com/pagopa/io-functions-fast-login/commit/1c1dc8ff8b69c83ebd5cc6468443c23b2beea5e2)

## 3.1.1

### Patch Changes

> 12 September 2023

## 3.1.1-RELEASE

> 12 September 2023

- [#IOPID-280] Filter non lollipop headers, fix blob save [`#16`](https://github.com/pagopa/io-functions-fast-login/pull/16)
- Bump version to 3.1.1 [skip ci] [`4144224`](https://github.com/pagopa/io-functions-fast-login/commit/4144224be020ff990977d5f0ec8612e055900a17)

## 3.1.0

### Minor Changes

> 12 September 2023

## 3.1.0-RELEASE

> 12 September 2023

- [#IOPID-280] Save audit logs [`#15`](https://github.com/pagopa/io-functions-fast-login/pull/15)
- Bump version to 3.1.0 [skip ci] [`20d3368`](https://github.com/pagopa/io-functions-fast-login/commit/20d336816f9010312c39f270ee82482c88e035e0)

## 3.0.0

### Major Changes

> 1 September 2023

## 3.0.0-RELEASE

> 1 September 2023

- [#IOPID-683] Additional header `x-pagopa-lv-client-ip` for fast login [`#14`](https://github.com/pagopa/io-functions-fast-login/pull/14)
- Bump version to 3.0.0 [skip ci] [`f377dbf`](https://github.com/pagopa/io-functions-fast-login/commit/f377dbfff35c70a19e709f633665aad80f68e6e2)

## 2.0.0

### Major Changes

> 12 July 2023

## 2.0.0-RELEASE

> 12 July 2023

- [#IOPID-394] The keyid field in signature-input is the thumbprint [`#10`](https://github.com/pagopa/io-functions-fast-login/pull/10)
- The keyid field in signature-input is the thumbprint [`ce04dcc`](https://github.com/pagopa/io-functions-fast-login/commit/ce04dcc00e61742dc71d1be2cc4caf140e9ce365)
- Bump version to 2.0.0 [skip ci] [`d1a1bfb`](https://github.com/pagopa/io-functions-fast-login/commit/d1a1bfbf683c8715e01361b12b2d432929555131)

## 1.1.0

### Minor Changes

> 4 July 2023

## 1.1.0-RELEASE

> 4 July 2023

- [#IOPID-268] Add FastLogin api for LC validation [`#9`](https://github.com/pagopa/io-functions-fast-login/pull/9)
- [#IOPID-267] include fast-login endpoint to internal spec [`#8`](https://github.com/pagopa/io-functions-fast-login/pull/8)
- fix endpoint location [`e3e1a74`](https://github.com/pagopa/io-functions-fast-login/commit/e3e1a74b1a37dd09fbe4e4468edff499cb9ef57d)
- [#IOPID-268] Add signature and SAMLResponse verify steps [`ae109fe`](https://github.com/pagopa/io-functions-fast-login/commit/ae109fed900321c48b5f65d1d965475a00681a2b)
- [#IOPID-267] fix: move fast-login endpoint to external spec [`a473017`](https://github.com/pagopa/io-functions-fast-login/commit/a47301778210de61571601b56848e0bcdc3f3583)

## 1.0.1

### Patch Changes

> 19 June 2023

## 1.0.1-RELEASE

> 19 June 2023

- Fix auto-changelog [`#7`](https://github.com/pagopa/io-functions-fast-login/pull/7)
- changed info url [`#6`](https://github.com/pagopa/io-functions-fast-login/pull/6)
- Bump version to 1.0.1 [skip ci] [`4265281`](https://github.com/pagopa/io-functions-fast-login/commit/4265281cea51ce393ae3784035692aca26548848)

## 1.0.0-RELEASE

> 19 June 2023

- fix predeploy script [`#5`](https://github.com/pagopa/io-functions-fast-login/pull/5)
- another deploy pipeline fix [`#4`](https://github.com/pagopa/io-functions-fast-login/pull/4)
- deploy pipeline fix [`#3`](https://github.com/pagopa/io-functions-fast-login/pull/3)
- [#IOPID-260] add azure devops deploy pipeline [`#2`](https://github.com/pagopa/io-functions-fast-login/pull/2)
- [#IOPID-260] add azure devops review pipeline [`#1`](https://github.com/pagopa/io-functions-fast-login/pull/1)
- First Commit [`f4904a5`](https://github.com/pagopa/io-functions-fast-login/commit/f4904a5edb8782a2c60ff56fba35221e76c7ae95)
- Update the Readme [`27ac434`](https://github.com/pagopa/io-functions-fast-login/commit/27ac43497bd57c0c788ddf2b9acc3be706b0056d)
- [#IOPID-260] add ts-jest dev dependency [`ef17256`](https://github.com/pagopa/io-functions-fast-login/commit/ef17256ea64ff2c75602b8e561d5c615c152529d)
