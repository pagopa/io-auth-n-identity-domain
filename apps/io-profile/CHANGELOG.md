# io-profile

## 5.25.3

### Patch Changes

- 526f4b3: Remove unused GetService endpoint

## 5.25.2

### Patch Changes

- 0eb8020: Extend retries to 20 attempts with retry interval capped at 20 minutes

## 5.25.1

### Patch Changes

- 03310ba: Dispose CosmosDB Client after healthcheck

## 5.25.0

### Minor Changes

- 8424122: Add IP logging in MagicLink generation

## 5.24.1

### Patch Changes

- 6fe208f: Fixed df imports

## 5.24.0

### Minor Changes

- 1e1e13c: Refactoring project structure and updating dependencies

## 5.23.0

### Minor Changes

- 49419a4: Clean Config, use cosmosDB connectionString instead of Key-Uri

## 5.22.0

### Minor Changes

- d19afc3: Move `StoreSpidLogs` function from `io-profile` to `io-profile-async`

## 5.21.0

### Minor Changes

- 9a6f85b: Removed OnProfileUpdate trigger

## 5.20.0

### Minor Changes

- 7e20167: Move `MigrateServicePreferenceFromLegacy` function from `io-profile` to `io-profile-async`

## 5.19.1

### Patch Changes

- f65c25d: Migrate FunctionApp io-profile from io-functions-app repo

## 5.19.0

### Minor Changes

- [#IOPID-2361] `GetVisibleServices` removal [`#321`](https://github.com/pagopa/io-functions-app/pull/321)

## 5.18.0

### Minor Changes

> 14 October 2024

## 5.18.0-RELEASE

> 14 October 2024

- [#IOPID-2332] `FF_TEMPLATE_EMAIL` removal [`#319`](https://github.com/pagopa/io-functions-app/pull/319)
- Bump version to 5.18.0 [skip ci] [`346db8c`](https://github.com/pagopa/io-functions-app/commit/346db8cc0893deb47c71b5242d0f15529b79536d)

## 5.17.0

### Minor Changes

> 10 October 2024

## 5.17.0-RELEASE

> 10 October 2024

- [#IOPID-2333] `FF_OPT_IN_EMAIL_ENABLED` removal [`#320`](https://github.com/pagopa/io-functions-app/pull/320)
- [#IOPID-2334] `FF_NEW_USERS_EUCOVIDCERT_ENABLED` removal [`#318`](https://github.com/pagopa/io-functions-app/pull/318)
- Bump nodemailer from 6.9.1 to 6.9.9 [`#308`](https://github.com/pagopa/io-functions-app/pull/308)
- Bump express from 4.18.2 to 4.20.0 [`#315`](https://github.com/pagopa/io-functions-app/pull/315)
- Bump version to 5.17.0 [skip ci] [`5a791db`](https://github.com/pagopa/io-functions-app/commit/5a791db9c8883fa92883aadc46b2fb354f63be9e)

## 5.16.0

### Minor Changes

> 10 October 2024

## 5.16.0-RELEASE

> 10 October 2024

- Bump version to 5.16.0 [skip ci] [`f28791c`](https://github.com/pagopa/io-functions-app/commit/f28791cc2984230c06fbef3d8f2ae207fa4bc7bd)

## 5.15.1

### Patch Changes

> 9 October 2024

## 5.15.1-RELEASE

> 9 October 2024

- [#IOPID-2331] `FF_UNIQUE_EMAIL_ENFORCEMENT` removal [`#317`](https://github.com/pagopa/io-functions-app/pull/317)
- [#IOPID-2039] changed deploy pipeline target [`#316`](https://github.com/pagopa/io-functions-app/pull/316)
- [EC-46] Add managed identities [`#314`](https://github.com/pagopa/io-functions-app/pull/314)
- Bump version to 5.15.1 [skip ci] [`ab14cfc`](https://github.com/pagopa/io-functions-app/commit/ab14cfcbd327193b553194a65828712ae3bcd9fe)

## 5.15.0

### Minor Changes

> 7 August 2024

## 5.15.0-RELEASE

> 7 August 2024

- [#IOPID-2118] extension bundle update [`#312`](https://github.com/pagopa/io-functions-app/pull/312)
- fix: integration tests not launching in CI [`#313`](https://github.com/pagopa/io-functions-app/pull/313)
- Bump version to 5.15.0 [skip ci] [`4de1c9a`](https://github.com/pagopa/io-functions-app/commit/4de1c9a7e885ac4cc396729c6a0d89e05cfa29bc)

## 5.14.2

### Patch Changes

> 17 April 2024

## 5.14.2-RELEASE

> 17 April 2024

- [#IOPID-1695] mail templates library [`#311`](https://github.com/pagopa/io-functions-app/pull/311)
- Bump version to 5.14.2 [skip ci] [`48cec5b`](https://github.com/pagopa/io-functions-app/commit/48cec5b0e0bd824d3ecea27fa70f6957d950f2ff)

## 5.14.1

### Patch Changes

> 6 March 2024

## 5.14.1-RELEASE

> 6 March 2024

- [#IOPID-1449] enable `strict=true` on typescript config [`#307`](https://github.com/pagopa/io-functions-app/pull/307)
- Bump version to 5.14.1 [skip ci] [`5f7cd81`](https://github.com/pagopa/io-functions-app/commit/5f7cd81b03c07a5c5101809a79636bbc102e98e3)

## 5.14.0

### Minor Changes

> 19 February 2024

## 5.14.0-RELEASE

> 19 February 2024

- [#IOPID-1444] name inside mailvalidation [`#304`](https://github.com/pagopa/io-functions-app/pull/304)
- Bump version to 5.14.0 [skip ci] [`2dfb985`](https://github.com/pagopa/io-functions-app/commit/2dfb9858458251ca15f069712e53519afa42a985)

## 5.13.1

### Patch Changes

> 15 February 2024

## 5.13.1-RELEASE

> 15 February 2024

- [#IOPID-1444] fix: updateProfile allOf type [`#306`](https://github.com/pagopa/io-functions-app/pull/306)
- Bump version to 5.13.1 [skip ci] [`ab02a12`](https://github.com/pagopa/io-functions-app/commit/ab02a12382e5293152ef9d06c0d136ac4f7067d9)

## 5.13.0

### Minor Changes

> 15 February 2024

## 5.13.0-RELEASE

> 15 February 2024

- [#IOPID-1444] profile name in updateProfile and startEmailValidationProcess [`#305`](https://github.com/pagopa/io-functions-app/pull/305)
- Bump version to 5.13.0 [skip ci] [`55ad2a6`](https://github.com/pagopa/io-functions-app/commit/55ad2a68d1de9308b3ec526fab0ab98b13a3b951)

## 5.12.4

### Patch Changes

> 8 February 2024

## 5.12.4-RELEASE

> 8 February 2024

- [#IOPID-1496] updated template version for login email [`#303`](https://github.com/pagopa/io-functions-app/pull/303)
- Bump version to 5.12.4 [skip ci] [`4b0cbc7`](https://github.com/pagopa/io-functions-app/commit/4b0cbc7e60634271e3e0d241cdada6bf905bec50)

## 5.12.3

### Patch Changes

> 30 January 2024

## 5.12.3-RELEASE

> 30 January 2024

- [#IOPID-1438] fix: wrong orchestrator name for email validation [`#302`](https://github.com/pagopa/io-functions-app/pull/302)
- Bump version to 5.12.3 [skip ci] [`9ee5f40`](https://github.com/pagopa/io-functions-app/commit/9ee5f40de8ed8d8505c025bc1c3816e7fc0653da)

## 5.12.2

### Patch Changes

> 26 January 2024

## 5.12.2-RELEASE

> 26 January 2024

- Fix Update Profile when email is undefined [`#301`](https://github.com/pagopa/io-functions-app/pull/301)
- Bump version to 5.12.2 [skip ci] [`2917815`](https://github.com/pagopa/io-functions-app/commit/2917815e82d994ffcdecbfe8d0d496a28bd3d078)

## 5.12.1

### Patch Changes

> 26 January 2024

## 5.12.1-RELEASE

> 26 January 2024

- [#IOPID-1422] fix: Avoid query with undefined email [`#300`](https://github.com/pagopa/io-functions-app/pull/300)
- Bump version to 5.12.1 [skip ci] [`10fba47`](https://github.com/pagopa/io-functions-app/commit/10fba47a638bfad9f4edc51c2ed050ebc841c69e)

## 5.12.0

### Minor Changes

> 26 January 2024

## 5.12.0-RELEASE

> 26 January 2024

- [#IOPID-1326] updated templated validation email [`#299`](https://github.com/pagopa/io-functions-app/pull/299)
- Bump version to 5.12.0 [skip ci] [`c4bbda3`](https://github.com/pagopa/io-functions-app/commit/c4bbda3918634b41ce38f794b44c335ff69bc45c)

## 5.11.4

### Patch Changes

> 15 January 2024

## 5.11.4-RELEASE

> 15 January 2024

- add feedPollDelay property [`#298`](https://github.com/pagopa/io-functions-app/pull/298)
- Bump version to 5.11.4 [skip ci] [`e2d38bf`](https://github.com/pagopa/io-functions-app/commit/e2d38bffd6b2ecbbcbb9dec88fffd0e3b4fa2409)

## 5.11.3

### Patch Changes

> 15 January 2024

## 5.11.3-RELEASE

> 15 January 2024

- [#IOPID-1197] Added missing email case and fixed profile decode [`#297`](https://github.com/pagopa/io-functions-app/pull/297)
- Bump version to 5.11.3 [skip ci] [`2e8f097`](https://github.com/pagopa/io-functions-app/commit/2e8f0977a7cb062d9ebd6f07b97c22fedc95c8ff)

## 5.11.2

### Patch Changes

> 12 January 2024

## 5.11.2-RELEASE

> 12 January 2024

- changed collection name [`#296`](https://github.com/pagopa/io-functions-app/pull/296)
- Bump version to 5.11.2 [skip ci] [`cce935d`](https://github.com/pagopa/io-functions-app/commit/cce935dfb7f9e473fe0a5f90da30049ce4bc40a2)

## 5.11.1

### Patch Changes

> 12 January 2024

## 5.11.1-RELEASE

> 12 January 2024

- add CosmosDB PackageReference [`#295`](https://github.com/pagopa/io-functions-app/pull/295)
- Bump version to 5.11.1 [skip ci] [`7605ae7`](https://github.com/pagopa/io-functions-app/commit/7605ae7d9b7bbb5021d659e82960447d9c70c708)

## 5.11.0

### Minor Changes

> 11 January 2024

## 5.11.0-RELEASE

> 11 January 2024

- [#IOPID-1197] Created function OnProfileUpdate [`#293`](https://github.com/pagopa/io-functions-app/pull/293)
- Bump version to 5.11.0 [skip ci] [`df876ef`](https://github.com/pagopa/io-functions-app/commit/df876ef22c17d2b9f20cc23f4cb90d23228ad947)

## 5.10.1

### Patch Changes

> 21 December 2023

## 5.10.1-RELEASE

> 21 December 2023

- [#IOPID-1286] changed login email title [`#294`](https://github.com/pagopa/io-functions-app/pull/294)
- Bump version to 5.10.1 [skip ci] [`f9e21b1`](https://github.com/pagopa/io-functions-app/commit/f9e21b1aca57c45986e4559d0bbdbbbff59e4cd0)

## 5.10.0

### Minor Changes

> 19 December 2023

## 5.10.0-RELEASE

> 19 December 2023

- [#IOPID-1264] Raise an error if uniqueness check fails [`#292`](https://github.com/pagopa/io-functions-app/pull/292)
- Bump version to 5.10.0 [skip ci] [`7b64041`](https://github.com/pagopa/io-functions-app/commit/7b640410222ac004109e7162bbe4016d15025e6d)

## 5.9.0

### Minor Changes

> 19 December 2023

## 5.9.0-RELEASE

> 19 December 2023

- [#IOPID-1192] added optional field to endpoint notify-login [`#288`](https://github.com/pagopa/io-functions-app/pull/288)
- Bump version to 5.9.0 [skip ci] [`f86dc1f`](https://github.com/pagopa/io-functions-app/commit/f86dc1fe61896554afcda5ce9470d19c513ec5e5)

## 5.8.1

### Patch Changes

> 19 December 2023

## 5.8.1-RELEASE

> 19 December 2023

- [#IOPID-1270] added precondition error type based on fn-commons enum [`#291`](https://github.com/pagopa/io-functions-app/pull/291)
- Bump version to 5.8.1 [skip ci] [`dad1ae8`](https://github.com/pagopa/io-functions-app/commit/dad1ae8b4ae5c8e6926532c9c2486d0c3b9c841a)

## 5.8.0

### Minor Changes

> 19 December 2023

## 5.8.0-RELEASE

> 19 December 2023

- [IOPID-1050, IOPID-1051] Add unique e-mail enforcement to UpdateProfile [`#290`](https://github.com/pagopa/io-functions-app/pull/290)
- Bump version to 5.8.0 [skip ci] [`7a332ce`](https://github.com/pagopa/io-functions-app/commit/7a332ce6f82d68f18ca4caefba86063560071d61)

## 5.7.0

### Minor Changes

> 18 December 2023

## 5.7.0-RELEASE

> 18 December 2023

- [IOPID-1046] Value is_email_already_taken in GetProfile [`#289`](https://github.com/pagopa/io-functions-app/pull/289)
- Bump version to 5.7.0 [skip ci] [`298c476`](https://github.com/pagopa/io-functions-app/commit/298c4761729aec5a1069960538f1d30877c4e115)

## 5.6.0

### Minor Changes

> 1 December 2023

## 5.6.0-RELEASE

> 1 December 2023

- [#IOPID-1078] add loginType data in spid-logs file name [`#287`](https://github.com/pagopa/io-functions-app/pull/287)
- Bump version to 5.6.0 [skip ci] [`7a28f78`](https://github.com/pagopa/io-functions-app/commit/7a28f78b273e630217106744e4cf68c0b0bac135)

## 5.5.0

### Minor Changes

> 30 November 2023

## 5.5.0-RELEASE

> 30 November 2023

- [#IOPID-869] updated login email templates [`#286`](https://github.com/pagopa/io-functions-app/pull/286)
- Bump version to 5.5.0 [skip ci] [`5ca33d0`](https://github.com/pagopa/io-functions-app/commit/5ca33d09b80d0c941ee391b46e7150066b331bc4)

## 5.4.0

### Minor Changes

> 16 October 2023

## 5.4.0-RELEASE

> 16 October 2023

- [#IOPID-867] magic link on login email [`#285`](https://github.com/pagopa/io-functions-app/pull/285)
- Bump version to 5.4.0 [skip ci] [`b72b513`](https://github.com/pagopa/io-functions-app/commit/b72b513077a67028de8ca574ef9cebdfc853f673)

## 5.3.0

### Minor Changes

> 10 August 2023

## 5.3.0-RELEASE

> 10 August 2023

- [#IOPID-571] update login email template [`#284`](https://github.com/pagopa/io-functions-app/pull/284)
- Bump version to 5.3.0 [skip ci] [`5c4edda`](https://github.com/pagopa/io-functions-app/commit/5c4edda05b426c5bf70e4a45515070a58167ac2e)

## 5.2.0

### Minor Changes

> 13 July 2023

## 5.2.0-RELEASE

> 13 July 2023

- [#IOPID-384] notice login email durable function [`#283`](https://github.com/pagopa/io-functions-app/pull/283)
- Bump version to 5.2.0 [skip ci] [`bd34e8c`](https://github.com/pagopa/io-functions-app/commit/bd34e8c1fbc6a299316328f08ce1220fd54307bf)

## 5.1.0

### Minor Changes

> 12 July 2023

## 5.1.0-RELEASE

> 12 July 2023

- [#IOPID-383] Add `notify-email` endpoint to openapi [`#282`](https://github.com/pagopa/io-functions-app/pull/282)
- [#IOPID-392] Add login email template [`#281`](https://github.com/pagopa/io-functions-app/pull/281)
- [IOPLT-25] Fixing io-functions-app configuration in order to be launched on local env [`#280`](https://github.com/pagopa/io-functions-app/pull/280)
- Bump version to 5.1.0 [skip ci] [`e241088`](https://github.com/pagopa/io-functions-app/commit/e241088e8743969f8760ee57c03a7373e4e5b4f8)

## 5.0.0

### Major Changes

> 26 April 2023

## 5.0.0-RELEASE

> 26 April 2023

- [#IOCOM-98] Migrate node 18 [`#277`](https://github.com/pagopa/io-functions-app/pull/277)
- Bump version to 5.0.0 [skip ci] [`d19b993`](https://github.com/pagopa/io-functions-app/commit/d19b993fa6c9e67ed8f157e659cb305ce6aca4c1)

## 4.7.0

### Minor Changes

> 30 March 2023

## 4.7.0-RELEASE

> 30 March 2023

- [#ICC-301] Update mail validation template [`#275`](https://github.com/pagopa/io-functions-app/pull/275)
- [#ICC-322] Replace danger with a github action [`#276`](https://github.com/pagopa/io-functions-app/pull/276)
- Bump version to 4.7.0 [skip ci] [`472d323`](https://github.com/pagopa/io-functions-app/commit/472d323555a9f8871df0096afc5f65e3ba769e81)

## 4.6.0

### Minor Changes

> 3 January 2023

## 4.6.0-RELEASE

> 3 January 2023

- Fix Fetch with Both HTTP or HTTPS support [`#272`](https://github.com/pagopa/io-functions-app/pull/272)
- Bump version to 4.6.0 [skip ci] [`50cc5e3`](https://github.com/pagopa/io-functions-app/commit/50cc5e358384a256aba1d0f2835ca25aac6884bf)

## 4.5.2

### Patch Changes

> 27 December 2022

## 4.5.2-RELEASE

> 27 December 2022

- upgrade @pagopa/openapi-codegen-ts [`#271`](https://github.com/pagopa/io-functions-app/pull/271)
- little fixes on README and env.example file [`#266`](https://github.com/pagopa/io-functions-app/pull/266)
- Bump version to 4.5.2 [skip ci] [`a96e71a`](https://github.com/pagopa/io-functions-app/commit/a96e71a35e9b6b01185779c2fad241475a2eb814)

## 4.5.1

### Patch Changes

> 23 November 2022

## 4.5.1-RELEASE

> 23 November 2022

- [#IOCIT-171] added support for functions v4 runtime [`#262`](https://github.com/pagopa/io-functions-app/pull/262)
- Bump version to 4.5.1 [skip ci] [`70c3d9c`](https://github.com/pagopa/io-functions-app/commit/70c3d9c3774310ac57ef88c73e684bd873db1da1)

## 4.5.0

### Minor Changes

> 27 October 2022

## 4.5.0-RELEASE

> 27 October 2022

- [#IOCIT-138] added push notifications content type optional field [`#260`](https://github.com/pagopa/io-functions-app/pull/260)
- Bump version to 4.5.0 [skip ci] [`2dbc0e0`](https://github.com/pagopa/io-functions-app/commit/2dbc0e076f97e6b988071de3796f7f8b96ddce6a)

## 4.4.0

### Minor Changes

> 29 September 2022

## 4.4.0-RELEASE

> 29 September 2022

- [#IOCIT-112] Modified GetProfile and UpdateProfile functions to manage Reminder opt-in flag [`#258`](https://github.com/pagopa/io-functions-app/pull/258)
- [#IOCIT-29] porting docker/fixtures/index.ts file to fp-ts 2 [`#257`](https://github.com/pagopa/io-functions-app/pull/257)
- Bump version to 4.4.0 [skip ci] [`32769db`](https://github.com/pagopa/io-functions-app/commit/32769dbcdfbc057e688e8defb7d61f12008a9925)

## 4.3.0

### Minor Changes

> 27 June 2022

## 4.3.0-RELEASE

> 27 June 2022

- [#IOCIT-9] Updated profile handlers to accept the new optional field from the profile model [`#255`](https://github.com/pagopa/io-functions-app/pull/255)
- Bump version to 4.3.0 [skip ci] [`101dcd2`](https://github.com/pagopa/io-functions-app/commit/101dcd2a7f066a9501b6bd11d95e84021dccacee)

## 4.2.0

### Minor Changes

> 22 June 2022

## 4.2.0-RELEASE

> 22 June 2022

- [#IOCIT-4] Added logic to manage new can_access_message_read_status choice [`#252`](https://github.com/pagopa/io-functions-app/pull/252)
- Bump version to 4.2.0 [skip ci] [`4efa427`](https://github.com/pagopa/io-functions-app/commit/4efa427330d56313af1c09447eb1a4c66dcd96d6)

## 4.1.0

### Minor Changes

> 20 June 2022

## 4.1.0-RELEASE

> 20 June 2022

- [#ICC-117] remove legacy endpoints and related definitions [`#254`](https://github.com/pagopa/io-functions-app/pull/254)
- Bump version to 4.1.0 [skip ci] [`6fa2058`](https://github.com/pagopa/io-functions-app/commit/6fa20583af62def7e26ead23af22fd1445b30f47)

## 4.0.2

### Patch Changes

> 17 June 2022

## 4.0.2-RELEASE

> 17 June 2022

- [ICC-116] Remove unused app messages endpoints [`#253`](https://github.com/pagopa/io-functions-app/pull/253)
- Bump version to 4.0.2 [skip ci] [`0787171`](https://github.com/pagopa/io-functions-app/commit/0787171eff80f09ac9cf9e1ba03fcb3b9d2d71ea)

## 4.0.1

### Patch Changes

> 28 March 2022

## 4.0.1-RELEASE

> 28 March 2022

- [#IC-391] fix UpsertMessageStatus spec [`#249`](https://github.com/pagopa/io-functions-app/pull/249)
- Bump version to 4.0.1 [skip ci] [`7434662`](https://github.com/pagopa/io-functions-app/commit/74346628b50a5c50028642074a1bb5e59286669d)

## 4.0.0

### Major Changes

> 9 March 2022

## 4.0.0-RELEASE

> 9 March 2022

- [#IC-328] New endpoint definition to upsert message status attributes [`#244`](https://github.com/pagopa/io-functions-app/pull/244)
- [#IC-295] Update GetMessages endpoint [`#243`](https://github.com/pagopa/io-functions-app/pull/243)
- [#IC-333] Add integrations tests [`#245`](https://github.com/pagopa/io-functions-app/pull/245)
- Bump version to 4.0.0 [skip ci] [`a8b00e3`](https://github.com/pagopa/io-functions-app/commit/a8b00e3f8fcc0e70e9e9c0cc3ddc36aad55f3fe3)

## 3.11.0

### Minor Changes

> 25 January 2022

## 3.11.0-RELEASE

> 25 January 2022

- [#IC-206] Enable multi-provider for Legal Message [`#238`](https://github.com/pagopa/io-functions-app/pull/238)
- Bump version to 3.11.0 [skip ci] [`fa8030a`](https://github.com/pagopa/io-functions-app/commit/fa8030aa0e3e41aef09eb4f04388d7521e4feb13)

## 3.10.0

### Minor Changes

> 23 December 2021

## 3.10.0-RELEASE

> 23 December 2021

- [#IC-68] Align backend references to last version [`#233`](https://github.com/pagopa/io-functions-app/pull/233)
- Bump version to 3.10.0 [skip ci] [`6c5a0be`](https://github.com/pagopa/io-functions-app/commit/6c5a0becef685bc6c71a1b3d5583cb37a31f931e)

## 3.9.0

### Minor Changes

> 23 December 2021

## 3.9.0-RELEASE

> 23 December 2021

- [#IC-68] Update Message model with legal data [`#231`](https://github.com/pagopa/io-functions-app/pull/231)
- Bump version to 3.9.0 [skip ci] [`941f69d`](https://github.com/pagopa/io-functions-app/commit/941f69d591f178e7a8933b92f9cd076f6e5844f4)

## 3.8.0

### Minor Changes

> 20 December 2021

## 3.8.0-RELEASE

> 20 December 2021

- [#IC-156] Configurable visible service source with envs [`#232`](https://github.com/pagopa/io-functions-app/pull/232)
- Bump version to 3.8.0 [skip ci] [`a9a939f`](https://github.com/pagopa/io-functions-app/commit/a9a939f93cac13812bd256ff84730d2d80202bdf)

## 3.7.0

### Minor Changes

> 9 December 2021

## 3.7.0-RELEASE

> 9 December 2021

- [#IC-100] Enrich Message with category [`#230`](https://github.com/pagopa/io-functions-app/pull/230)
- Bump version to 3.7.0 [skip ci] [`4ddacbb`](https://github.com/pagopa/io-functions-app/commit/4ddacbb5b0e8f97d2defe42468a5d17b2883e981)

## 3.6.0

### Minor Changes

> 2 December 2021

## 3.6.0-RELEASE

> 2 December 2021

- [#IC-44] Add support for Special Services [`#229`](https://github.com/pagopa/io-functions-app/pull/229)
- Bump version to 3.6.0 [skip ci] [`27ce38a`](https://github.com/pagopa/io-functions-app/commit/27ce38af1aef0fb188cc84f4cfc4baff9b7fa231)

## 3.5.0

### Minor Changes

> 9 November 2021

## 3.5.0-RELEASE

> 9 November 2021

- chore(deps): bump vm2 from 3.9.3 to 3.9.5 [`#224`](https://github.com/pagopa/io-functions-app/pull/224)
- [#IC-31] Dismantle EUCovidcert notifications [`#228`](https://github.com/pagopa/io-functions-app/pull/228)
- Bump version to 3.5.0 [skip ci] [`f6eaa86`](https://github.com/pagopa/io-functions-app/commit/f6eaa86eceaca614e5d52669efda3402cce30573)

## 3.4.0

### Minor Changes

> 3 November 2021

## 3.4.0-RELEASE

> 3 November 2021

- [#IP-438] Emit profile related events [`#227`](https://github.com/pagopa/io-functions-app/pull/227)
- Bump version to 3.4.0 [skip ci] [`2b311b5`](https://github.com/pagopa/io-functions-app/commit/2b311b58f424d8d51e9543ffd9a8ec53b8abd77a)

## 3.3.1

### Patch Changes

> 3 November 2021

## 3.3.1-RELEASE

> 3 November 2021

- [#IP-438] Do not use new `UpsertedProfileOrchestratorV2` for the moment [`#226`](https://github.com/pagopa/io-functions-app/pull/226)
- Bump version to 3.3.1 [skip ci] [`2ce83b7`](https://github.com/pagopa/io-functions-app/commit/2ce83b7e9e9e25e5ab181b92381e25da79a38cdf)
- hotfix pipeline [`6fbd65f`](https://github.com/pagopa/io-functions-app/commit/6fbd65ffd697ba0933a96543d920ae7d8b47df47)

## 3.3.0

### Minor Changes

> 3 November 2021

## 3.3.0-RELEASE

> 3 November 2021

- [#IP-438] Emit domain events about service subscriptions [`#225`](https://github.com/pagopa/io-functions-app/pull/225)
- [#ip-457] update codegen to fix client SDK generation [`#223`](https://github.com/pagopa/io-functions-app/pull/223)
- [#ip-456] Upgrade pipelines template to v18 [`#222`](https://github.com/pagopa/io-functions-app/pull/222)
- Bump version to 3.3.0 [skip ci] [`7e4bdcd`](https://github.com/pagopa/io-functions-app/commit/7e4bdcd50e8685c53dc029b86aa0dd0adc19d8af)

## 3.2.0

### Minor Changes

> 12 October 2021

## 3.2.0-RELEASE

> 12 October 2021

- [#IP-182] Upgrade GetMessage model with payee [`#219`](https://github.com/pagopa/io-functions-app/pull/219)
- Bump version to 3.2.0 [skip ci] [`c483579`](https://github.com/pagopa/io-functions-app/commit/c48357924e50d0410ac5778654119a7088079c7f)

## 3.1.6

### Patch Changes

> 8 October 2021

## 3.1.6-RELEASE

> 8 October 2021

- [fix] One liner fix to make decoding work over io-ts 1.x bug [`#221`](https://github.com/pagopa/io-functions-app/pull/221)
- Bump version to 3.1.6 [skip ci] [`db21a3c`](https://github.com/pagopa/io-functions-app/commit/db21a3c3002da1a58c1650a3e94e42ddc4e2c9eb)

## 3.1.5

### Patch Changes

> 7 October 2021

## 3.1.5-RELEASE

> 7 October 2021

- [#IP-408] Error tracking for enrichment (plus small fix) [`#220`](https://github.com/pagopa/io-functions-app/pull/220)
- Bump version to 3.1.5 [skip ci] [`d3dd6bf`](https://github.com/pagopa/io-functions-app/commit/d3dd6bf643d191391dfe39bb1d5e0c0390ec9013)

## 3.1.4

### Patch Changes

> 1 October 2021

## 3.1.4-RELEASE

> 1 October 2021

- fixed import [`#218`](https://github.com/pagopa/io-functions-app/pull/218)
- Bump version to 3.1.4 [skip ci] [`029918e`](https://github.com/pagopa/io-functions-app/commit/029918e2a6cdfbbd1b09f996adb92704099b5b83)

## 3.1.3

### Patch Changes

> 1 October 2021

## 3.1.3-RELEASE

> 1 October 2021

- Fixes openapi [`#217`](https://github.com/pagopa/io-functions-app/pull/217)
- pr template [`11afa5f`](https://github.com/pagopa/io-functions-app/commit/11afa5fe403aa3a4275bfb5b19e3be500d4f06c3)
- Bump version to 3.1.3 [skip ci] [`7455e17`](https://github.com/pagopa/io-functions-app/commit/7455e175005405a38e89e66de57e65f4b6a839f3)

## 3.1.2

### Patch Changes

> 28 September 2021

## 3.1.2-RELEASE

> 28 September 2021

- [#IP-410] Dismiss `UpsertedProfileOrchestratorV2` step 1: duplication [`#215`](https://github.com/pagopa/io-functions-app/pull/215)
- Bump version to 3.1.2 [skip ci] [`fd8f060`](https://github.com/pagopa/io-functions-app/commit/fd8f060da230e3ca87586d31c18d619dacf647dd)

## 3.1.1

### Patch Changes

> 27 September 2021

## 3.1.1-RELEASE

> 27 September 2021

- fixed pipeline [`#214`](https://github.com/pagopa/io-functions-app/pull/214)
- Fix healthcheck [`#212`](https://github.com/pagopa/io-functions-app/pull/212)
- fixed version of fn-commons [`#213`](https://github.com/pagopa/io-functions-app/pull/213)
- [#IP-402] Migrated tslint to eslint [`#211`](https://github.com/pagopa/io-functions-app/pull/211)
- chore(deps): bump tmpl from 1.0.4 to 1.0.5 [`#210`](https://github.com/pagopa/io-functions-app/pull/210)
- chore(deps): bump axios from 0.21.1 to 0.21.4 [`#209`](https://github.com/pagopa/io-functions-app/pull/209)
- Bump version to 3.1.1 [skip ci] [`12f5972`](https://github.com/pagopa/io-functions-app/commit/12f597230a9057242e6b8bd3c21ce04cafacd822)

## 3.1.0

### Minor Changes

> 21 September 2021

## 3.1.0-RELEASE

> 21 September 2021

- [#IP-362] Messages with pagination [`#203`](https://github.com/pagopa/io-functions-app/pull/203)
- switch fiscalCode with spidRequestId in StoreSpidLogs [`#192`](https://github.com/pagopa/io-functions-app/pull/192)
- Bump version to 3.1.0 [skip ci] [`a8a143a`](https://github.com/pagopa/io-functions-app/commit/a8a143a6e2bef565b426a86ecd58af7b5542fb86)
- restore CODEOWNERS [`7a03552`](https://github.com/pagopa/io-functions-app/commit/7a035526d5d23fe2fbfaaf316f37bbb2352f731a)

## 3.0.0

### Major Changes

> 2 September 2021

## 3.0.0-RELEASE

> 2 September 2021

- [#IP-379] Upgrade fp-ts [`#202`](https://github.com/pagopa/io-functions-app/pull/202)
- Bump version to 3.0.0 [skip ci] [`759d9c7`](https://github.com/pagopa/io-functions-app/commit/759d9c78ea0fff7cf02741e451239e4ae53f6e48)

## 2.2.1

### Patch Changes

> 31 August 2021

## 2.2.1-RELEASE

> 31 August 2021

- [#IP-368] table service unhandled exception [`#197`](https://github.com/pagopa/io-functions-app/pull/197)
- fix - pagopa web site url [`#201`](https://github.com/pagopa/io-functions-app/pull/201)
- Bump version to 2.2.1 [skip ci] [`df4a700`](https://github.com/pagopa/io-functions-app/commit/df4a7004b3671260769130d334c8c92a6aa81529)

## 2.2.0

### Minor Changes

> 24 August 2021

## 2.2.0-RELEASE

> 24 August 2021

- Change durable function storage [`#200`](https://github.com/pagopa/io-functions-app/pull/200)
- fix sdk build stage [`#198`](https://github.com/pagopa/io-functions-app/pull/198)
- [#ip-371] remove codeonwers [`#199`](https://github.com/pagopa/io-functions-app/pull/199)
- Bump version to 2.2.0 [skip ci] [`f1611ba`](https://github.com/pagopa/io-functions-app/commit/f1611ba061457be40d5594875874e1225a77ce6f)

## 2.1.1

### Patch Changes

> 18 August 2021

## 2.1.1-RELEASE

> 18 August 2021

- [#IP-345] Update Node to 14.16.0 [`#195`](https://github.com/pagopa/io-functions-app/pull/195)
- chore(deps): bump tar from 4.4.10 to 4.4.17 [`#196`](https://github.com/pagopa/io-functions-app/pull/196)
- chore(deps): bump path-parse from 1.0.6 to 1.0.7 [`#193`](https://github.com/pagopa/io-functions-app/pull/193)
- [#IP-325] Upgrade Typescript to v. 4.3.5 [`#190`](https://github.com/pagopa/io-functions-app/pull/190)
- Bump version to 2.1.1 [skip ci] [`98b1414`](https://github.com/pagopa/io-functions-app/commit/98b1414bae987513ebcc14f69ac892adef8e6b56)

## 2.1.0

### Minor Changes

> 9 August 2021

## 2.1.0-RELEASE

> 9 August 2021

- [#IP-308] Fix Subscription Feed on settings mode change [`#189`](https://github.com/pagopa/io-functions-app/pull/189)
- [#IP-306] Handle Cosmos unix timestamp format [`#186`](https://github.com/pagopa/io-functions-app/pull/186)
- Bump version to 2.1.0 [skip ci] [`3c5cd13`](https://github.com/pagopa/io-functions-app/commit/3c5cd1345bb5811f8d0603ed17271d8bc490810a)

## 2.0.3

### Patch Changes

> 13 July 2021

## 2.0.3-RELEASE

> 13 July 2021

- [#IP-307] Add tracking for LEGACY upgrades [`#187`](https://github.com/pagopa/io-functions-app/pull/187)
- Bump version to 2.0.3 [skip ci] [`252d997`](https://github.com/pagopa/io-functions-app/commit/252d997830920626e9e968953efc96f43a0764dc)

## 2.0.2

### Patch Changes

> 9 July 2021

## 2.0.2-RELEASE

> 9 July 2021

- Bump version to 2.0.2 [skip ci] [`19e280f`](https://github.com/pagopa/io-functions-app/commit/19e280f9aad427c741723ff6ae492a21626752fe)
- add log [`84bbbba`](https://github.com/pagopa/io-functions-app/commit/84bbbba213fab55e9412dfb75a43e22d73a989fd)

## 2.0.1

### Patch Changes

> 9 July 2021

## 2.0.1-RELEASE

> 9 July 2021

- [#IP-304] Trace custom events for service preferences [`#185`](https://github.com/pagopa/io-functions-app/pull/185)
- Bump version to 2.0.1 [skip ci] [`76ba594`](https://github.com/pagopa/io-functions-app/commit/76ba594109482d6fecb5aef1d6a418b073fbdb4b)

## 2.0.0

### Major Changes

> 9 July 2021

## 2.0.0-RELEASE

> 9 July 2021

- [#IP-293] migrate services preferences from legacy [`#181`](https://github.com/pagopa/io-functions-app/pull/181)
- Update handler.ts [`#184`](https://github.com/pagopa/io-functions-app/pull/184)
- [#IP-299] Add SubscriptionFeed Update on ServicePreference upsert [`#183`](https://github.com/pagopa/io-functions-app/pull/183)
- [#IP-298] Add Subscription feed update logic based on servicePreferenceSetting mode [`#182`](https://github.com/pagopa/io-functions-app/pull/182)
- MOve OPT_OUT_EMAIL_SWITCH_DATE to Timestamp format [`#180`](https://github.com/pagopa/io-functions-app/pull/180)
- Bump version to 2.0.0 [skip ci] [`0e9aa3f`](https://github.com/pagopa/io-functions-app/commit/0e9aa3f1a8151566ed774e18eb1497115932c613)

## 1.43.0

### Minor Changes

> 5 July 2021

## 1.43.0-RELEASE

> 5 July 2021

- Add FF_OPT_OUT_EMAIL_ENABLED Feature flag [`#179`](https://github.com/pagopa/io-functions-app/pull/179)
- [#IP-269] Add UpsertServicePreferences endpoint [`#177`](https://github.com/pagopa/io-functions-app/pull/177)
- Rename env variable to OPT_OUT_EMAIL_SWITCH_DATE [`#178`](https://github.com/pagopa/io-functions-app/pull/178)
- [#IP-283] Set isEmailEnabled default to false [`#172`](https://github.com/pagopa/io-functions-app/pull/172)
- [#IP-284] add timestamp check on profile for is_email_enabled [`#174`](https://github.com/pagopa/io-functions-app/pull/174)
- [#ip-286] update pipelines [`#176`](https://github.com/pagopa/io-functions-app/pull/176)
- [#IP-270] Add GetServicePreference endopoint [`#170`](https://github.com/pagopa/io-functions-app/pull/170)
- Fix Client SDK Generation [`#145`](https://github.com/pagopa/io-functions-app/pull/145)
- chore(deps): bump y18n from 3.2.1 to 3.2.2 [`#155`](https://github.com/pagopa/io-functions-app/pull/155)
- chore(deps): bump hosted-git-info from 2.7.1 to 2.8.9 [`#161`](https://github.com/pagopa/io-functions-app/pull/161)
- chore(deps): bump color-string from 1.5.4 to 1.5.5 [`#173`](https://github.com/pagopa/io-functions-app/pull/173)
- chore(deps): bump ws from 5.2.2 to 5.2.3 [`#168`](https://github.com/pagopa/io-functions-app/pull/168)
- chore(deps): bump nodemailer from 4.7.0 to 6.4.16 [`#162`](https://github.com/pagopa/io-functions-app/pull/162)
- [#IP-278] ServicePreferencesSettings version update when mode changes [`#171`](https://github.com/pagopa/io-functions-app/pull/171)
- Bump version to 1.43.0 [skip ci] [`a57fdd3`](https://github.com/pagopa/io-functions-app/commit/a57fdd375fe668f75cbe47669993a784b9a08652)
- fix deploy pipeline [`c286a4b`](https://github.com/pagopa/io-functions-app/commit/c286a4b6e4967175e264a64b0b8cba98952cc430)
- fix pipeline [`c336608`](https://github.com/pagopa/io-functions-app/commit/c33660827856ec02555047596ef82123802b697d)

## 1.42.0

### Minor Changes

> 14 June 2021

## 1.42.0-RELEASE

> 14 June 2021

- [#IPV-52] Enqueue a message when a User Profile is activated [`#163`](https://github.com/pagopa/io-functions-app/pull/163)
- set io-backend model version to v7.16.0 [`#166`](https://github.com/pagopa/io-functions-app/pull/166)
- Bump version to 1.42.0 [skip ci] [`5f00d6d`](https://github.com/pagopa/io-functions-app/commit/5f00d6d2de26730b1a43ce51450558c1e82628b4)

## 1.41.0

### Minor Changes

> 7 June 2021

## 1.41.0-RELEASE

> 7 June 2021

- [#IP-179] Mitigation for the Azure Durable Functions extension error [`#165`](https://github.com/pagopa/io-functions-app/pull/165)
- chore(deps): bump handlebars from 4.5.3 to 4.7.7 [`#159`](https://github.com/pagopa/io-functions-app/pull/159)
- chore(deps): bump lodash from 4.17.20 to 4.17.21 [`#160`](https://github.com/pagopa/io-functions-app/pull/160)
- [#IP-216] Update GetMessage models [`#164`](https://github.com/pagopa/io-functions-app/pull/164)
- [#IP-50] Removed code moved into new `io-functions-pushnotifications` [`#154`](https://github.com/pagopa/io-functions-app/pull/154)
- Bump version to 1.41.0 [skip ci] [`70f7394`](https://github.com/pagopa/io-functions-app/commit/70f7394ccba6f5b6821e93504f0818be1d7e4370)
- Update CODEOWNERS [`d3ca608`](https://github.com/pagopa/io-functions-app/commit/d3ca6084d9a2b8cd4d816682b35cf4d3cbee0002)

## 1.40.2

### Patch Changes

> 2 April 2021

## 1.40.2-RELEASE

> 2 April 2021

- [#IP-122] Reduce log data ingestion [`#156`](https://github.com/pagopa/io-functions-app/pull/156)
- Added '@pagopa/' to package name [`#144`](https://github.com/pagopa/io-functions-app/pull/144)
- Bump version to 1.40.2 [skip ci] [`5a35d9f`](https://github.com/pagopa/io-functions-app/commit/5a35d9fa4cd76b640eccce8e5dd1db04cf90698c)

## 1.40.1

### Patch Changes

> 8 February 2021

## 1.40.1-RELEASE

> 8 February 2021

- chore(deps): bump highlight.js from 10.0.3 to 10.4.1 [`#126`](https://github.com/pagopa/io-functions-app/pull/126)
- fix: upgrade durable-functions from 1.4.1 to 1.4.3 [`#105`](https://github.com/pagopa/io-functions-app/pull/105)
- [#176591026] Added new stage for deploying client SDK to NPM [`#142`](https://github.com/pagopa/io-functions-app/pull/142)
- [#176591026] Added new stage for deploying client SDK to NPM (#142) [`#176591026`](https://www.pivotaltracker.com/story/show/176591026) [`#221686427`](https://www.pivotaltracker.com/story/show/221686427) [`#176591026`](https://www.pivotaltracker.com/story/show/176591026)
- Bump version to 1.40.1 [skip ci] [`84e9c46`](https://github.com/pagopa/io-functions-app/commit/84e9c467c098f8d78d04dea3b8c218ace3504b64)

## 1.40.0

### Minor Changes

> 29 January 2021

## 1.40.0-RELEASE

> 29 January 2021

- Temporarily disable LOCAL scoped services [`#140`](https://github.com/pagopa/io-functions-app/pull/140)
- updated io-functions-commons to @pagopa/io-function-commons [`#138`](https://github.com/pagopa/io-functions-app/pull/138)
- Bump version to 1.40.0 [skip ci] [`8d8a130`](https://github.com/pagopa/io-functions-app/commit/8d8a130e740a7ddd4225fc87642eb73ae5d54b26)

## 1.39.10

### Patch Changes

> 12 January 2021

## 1.39.10-RELEASE

> 12 January 2021

- chore(deps): bump lodash from 4.17.15 to 4.17.20 [`#124`](https://github.com/pagopa/io-functions-app/pull/124)
- chore(deps): bump ini from 1.3.5 to 1.3.7 [`#134`](https://github.com/pagopa/io-functions-app/pull/134)
- Bump version to 1.39.10 [skip ci] [`3814ef2`](https://github.com/pagopa/io-functions-app/commit/3814ef239085df4828a3b11534e9a9d397423e7d)

## 1.39.9

### Patch Changes

> 18 December 2020

## 1.39.9-RELEASE

> 18 December 2020

- Bump version to 1.39.9 [skip ci] [`3781156`](https://github.com/pagopa/io-functions-app/commit/378115646c31d329cbe69dcdde20e9407823a638)
- hotfix typos [`ce8d965`](https://github.com/pagopa/io-functions-app/commit/ce8d965b13e602eb41a2055515dcbe1c857a663f)

## 1.39.8

### Patch Changes

> 18 December 2020

## 1.39.8-RELEASE

> 18 December 2020

- Bump version to 1.39.8 [skip ci] [`17d4b68`](https://github.com/pagopa/io-functions-app/commit/17d4b68eba0f5e183c397e1d19618fcf4326b716)
- hotfix healthcheck endpoint [`16de7b5`](https://github.com/pagopa/io-functions-app/commit/16de7b5c057f60108b5291e14a65fee384bcbdae)

## 1.39.7

### Patch Changes

> 17 December 2020

## 1.39.7-RELEASE

> 17 December 2020

- Bump version to 1.39.7 [skip ci] [`0cd9dbe`](https://github.com/pagopa/io-functions-app/commit/0cd9dbeba03fecd348d29b898124250040136afa)
- hotfix container [`4fe6ecc`](https://github.com/pagopa/io-functions-app/commit/4fe6ecc1eb811b445db08f1014d48bf1f0fb43b8)

## 1.39.6

### Patch Changes

> 17 December 2020

## 1.39.6-RELEASE

> 17 December 2020

- Bump version to 1.39.6 [skip ci] [`fa8d3ea`](https://github.com/pagopa/io-functions-app/commit/fa8d3ea02542c99dff1c1546bf21a470f5fc0568)
- hotfix container [`551bdb1`](https://github.com/pagopa/io-functions-app/commit/551bdb1de43731f593d4cca67775c84965c5cb49)

## 1.39.5

### Patch Changes

> 17 December 2020

## 1.39.5-RELEASE

> 17 December 2020

- Bump version to 1.39.5 [skip ci] [`60eef9c`](https://github.com/pagopa/io-functions-app/commit/60eef9ce9bd03ae2698e8808ca7166caa0471d9f)

## 1.39.4

### Patch Changes

> 17 December 2020

## 1.39.4-RELEASE

> 17 December 2020

- Bump version to 1.39.4 [skip ci] [`630454f`](https://github.com/pagopa/io-functions-app/commit/630454f8ac66df1fa0d9adf72ae6b94c25b15ebb)

## 1.39.3

### Patch Changes

> 17 December 2020

## 1.39.3-RELEASE

> 17 December 2020

- [#176095347] deploy to multiple app services [`#136`](https://github.com/pagopa/io-functions-app/pull/136)
- [#176095347] deploy to multiple app services (#136) [`#176095347`](https://www.pivotaltracker.com/story/show/176095347) [`#176095347`](https://www.pivotaltracker.com/story/show/176095347) [`#176095347`](https://www.pivotaltracker.com/story/show/176095347)
- Bump version to 1.39.3 [skip ci] [`c8ede67`](https://github.com/pagopa/io-functions-app/commit/c8ede678ed0100cc8515c3f37ff788e91945ab0d)
- Update CODEOWNERS [`ca08b58`](https://github.com/pagopa/io-functions-app/commit/ca08b582cad6db46618143eb2d1b3e287bf2be5d)

## 1.39.2

### Patch Changes

> 16 December 2020

## 1.39.2-RELEASE

> 16 December 2020

- Bump version to 1.39.2 [skip ci] [`a9c3964`](https://github.com/pagopa/io-functions-app/commit/a9c3964f3f8a1091c86ec52316de49557a63c058)
- Hotfix: moved date-fns from dev to production deps [`95a686d`](https://github.com/pagopa/io-functions-app/commit/95a686d022be0b6df47b5bac0ecdc3dba9b01ace)

## 1.39.1

### Patch Changes

> 16 December 2020

## 1.39.1-RELEASE

> 16 December 2020

- Add date-fns module [`#137`](https://github.com/pagopa/io-functions-app/pull/137)
- [#176068662] Enable check on EmailValidation Orchestrator [`#132`](https://github.com/pagopa/io-functions-app/pull/132)
- [#176068662] Enable check on EmailValidation Orchestrator (#132) [`#176068662`](https://www.pivotaltracker.com/story/show/176068662) [`#176068662`](https://www.pivotaltracker.com/story/show/176068662) [`#176068662`](https://www.pivotaltracker.com/story/show/176068662) [`#176068662`](https://www.pivotaltracker.com/story/show/176068662) [`#176068662`](https://www.pivotaltracker.com/story/show/176068662) [`#176068662`](https://www.pivotaltracker.com/story/show/176068662) [`#176068662`](https://www.pivotaltracker.com/story/show/176068662) [`#176068662`](https://www.pivotaltracker.com/story/show/176068662) [`#176068662`](https://www.pivotaltracker.com/story/show/176068662)
- Bump version to 1.39.1 [skip ci] [`286d1b6`](https://github.com/pagopa/io-functions-app/commit/286d1b60dedbf20cf9e72e69520d69eb2e6140d5)

## 1.39.0

### Minor Changes

> 14 December 2020

## 1.39.0-RELEASE

> 14 December 2020

- [#176082784] Add keepalive to notification hub client [`#135`](https://github.com/pagopa/io-functions-app/pull/135)
- [#176082784] Add keepalive to notification hub client (#135) [`#176082784`](https://www.pivotaltracker.com/story/show/176082784)
- Bump version to 1.39.0 [skip ci] [`704cb0d`](https://github.com/pagopa/io-functions-app/commit/704cb0db8493c6fb1041750e41021df4eab8c985)

## 1.38.5

### Patch Changes

> 8 December 2020

## 1.38.5-RELEASE

> 8 December 2020

- Bump version to 1.38.5 [skip ci] [`f607ae9`](https://github.com/pagopa/io-functions-app/commit/f607ae9da4accdd437a93595df2508885f28ffad)

## 1.38.4

### Patch Changes

> 8 December 2020

## 1.38.4-RELEASE

> 8 December 2020

- Bump version to 1.38.4 [skip ci] [`7f5997c`](https://github.com/pagopa/io-functions-app/commit/7f5997ced9e908fff9227e3e6cd2f7085bbccb36)

## 1.38.3

### Patch Changes

> 8 December 2020

## 1.38.3-RELEASE

> 8 December 2020

- [#176056514] Add ping endpoint [`#131`](https://github.com/pagopa/io-functions-app/pull/131)
- [#176056514] Add ping endpoint (#131) [`#176056514`](https://www.pivotaltracker.com/story/show/176056514) [`#176056514`](https://www.pivotaltracker.com/story/show/176056514)
- Bump version to 1.38.3 [skip ci] [`6ad7029`](https://github.com/pagopa/io-functions-app/commit/6ad7029f48ff6f46e25b3fb96743d3e7b6ac2ea1)

## 1.38.2

### Patch Changes

> 8 December 2020

## 1.38.2-RELEASE

> 8 December 2020

- Bump version to 1.38.2 [skip ci] [`4ed2c8d`](https://github.com/pagopa/io-functions-app/commit/4ed2c8d78e39f5a0455ae7f53937238ba37138a1)

## 1.38.1

### Patch Changes

> 8 December 2020

## 1.38.1-RELEASE

> 8 December 2020

- Bump version to 1.38.1 [skip ci] [`22819ed`](https://github.com/pagopa/io-functions-app/commit/22819ed4711786831c2ea7a7a682ccbfd155e553)

## 1.38.0

### Minor Changes

> 7 December 2020

## 1.38.0-RELEASE

> 7 December 2020

- Bump version to 1.38.0 [skip ci] [`416f2de`](https://github.com/pagopa/io-functions-app/commit/416f2deccd7667d2c495d710ec353f9e4a7e3a8c)

## 1.37.0

### Minor Changes

> 7 December 2020

## 1.37.0-RELEASE

> 7 December 2020

- [#176039779] Optimize versioned record query [`#130`](https://github.com/pagopa/io-functions-app/pull/130)
- [#176039779] Optimize versioned record query (#130) [`#176039779`](https://www.pivotaltracker.com/story/show/176039779)
- Bump version to 1.37.0 [skip ci] [`7e66e97`](https://github.com/pagopa/io-functions-app/commit/7e66e971e57aa65320e7943a5d6edeb2ab76bbb6)

## 1.36.0

### Minor Changes

> 7 December 2020

## 1.36.0-RELEASE

> 7 December 2020

- Bump version to 1.36.0 [skip ci] [`5e93e4e`](https://github.com/pagopa/io-functions-app/commit/5e93e4e6b24f757e6348b38ad01964e19571b06e)

## 1.35.0

### Minor Changes

> 6 December 2020

## 1.35.0-RELEASE

> 6 December 2020

- Restore info handler [`#129`](https://github.com/pagopa/io-functions-app/pull/129)
- Bump version to 1.35.0 [skip ci] [`6dfddc4`](https://github.com/pagopa/io-functions-app/commit/6dfddc48f054875f09f62c695c02946d1558d301)

## 1.34.0

### Minor Changes

> 5 December 2020

## 1.34.0-RELEASE

> 5 December 2020

- Bump version to 1.34.0 [skip ci] [`8a4f19a`](https://github.com/pagopa/io-functions-app/commit/8a4f19a78e9a02702a4546ad5b4d1bf9848b7501)

## 1.33.0

### Minor Changes

> 5 December 2020

## 1.33.0-RELEASE

> 5 December 2020

- Remove info endpoint [`#128`](https://github.com/pagopa/io-functions-app/pull/128)
- Bump version to 1.33.0 [skip ci] [`aaee4a0`](https://github.com/pagopa/io-functions-app/commit/aaee4a0e14c9e7607c63ded4ec033dd8b262d246)

## 1.32.0

### Minor Changes

> 5 December 2020

## 1.32.0-RELEASE

> 5 December 2020

- upgrade italia-utils [`#127`](https://github.com/pagopa/io-functions-app/pull/127)
- Bump version to 1.32.0 [skip ci] [`fecad35`](https://github.com/pagopa/io-functions-app/commit/fecad3504219a5fd29a98702efd62cfe75069ba0)

## 1.31.2

### Patch Changes

> 4 December 2020

## 1.31.2-RELEASE

> 4 December 2020

- [#175932626] Update HOWTO welcome message [`#125`](https://github.com/pagopa/io-functions-app/pull/125)
- [#175932626] Send Cashback welcome message [`#122`](https://github.com/pagopa/io-functions-app/pull/122)
- [#175476527] Release pipeline and pipeline refactor [`#123`](https://github.com/pagopa/io-functions-app/pull/123)
- [#175932626] Update HOWTO welcome message (#125) [`#175932626`](https://www.pivotaltracker.com/story/show/175932626)
- [#175932626] Send Cashback welcome message (#122) [`#175932626`](https://www.pivotaltracker.com/story/show/175932626) [`#175932626`](https://www.pivotaltracker.com/story/show/175932626) [`#175932626`](https://www.pivotaltracker.com/story/show/175932626) [`#175932626`](https://www.pivotaltracker.com/story/show/175932626) [`#175932626`](https://www.pivotaltracker.com/story/show/175932626) [`#175932626`](https://www.pivotaltracker.com/story/show/175932626) [`#175932626`](https://www.pivotaltracker.com/story/show/175932626) [`#175932626`](https://www.pivotaltracker.com/story/show/175932626)
- [#175476527] Release pipeline and pipeline refactor (#123) [`#175476527`](https://www.pivotaltracker.com/story/show/175476527)
- Bump version to 1.31.2 [skip ci] [`626b3b2`](https://github.com/pagopa/io-functions-app/commit/626b3b23da20f1ae268c200dc279016a17cad8d1)

## 1.31.1

### Patch Changes

> 30 November 2020

- Fix default deploy configuration [`#120`](https://github.com/pagopa/io-functions-app/pull/120)
- [#175126219] Healthcheck step in pipeline [`#117`](https://github.com/pagopa/io-functions-app/pull/117)
- [#175119536] healthcheck endpoint [`#116`](https://github.com/pagopa/io-functions-app/pull/116)
- Update handler.ts [`#119`](https://github.com/pagopa/io-functions-app/pull/119)
- [#175126219] Healthcheck step in pipeline (#117) [`#175126219`](https://www.pivotaltracker.com/story/show/175126219) [`#175126219`](https://www.pivotaltracker.com/story/show/175126219) [`#175126219`](https://www.pivotaltracker.com/story/show/175126219)
- [#175119536] healthcheck endpoint (#116) [`#175119536`](https://www.pivotaltracker.com/story/show/175119536)
- chore: release 1.31.1 [`ff1aabe`](https://github.com/pagopa/io-functions-app/commit/ff1aabeef7feb591aa78c214dfc82fe35fa400bf)
- Update azure-pipelines.yml for Azure Pipelines [`42cd901`](https://github.com/pagopa/io-functions-app/commit/42cd901dde0ad4f58c1c74ca08ff96d1f7a92e3b)

## 1.31.0

### Minor Changes

> 19 November 2020

- [#175488816] change welcome message [`#115`](https://github.com/pagopa/io-functions-app/pull/115)
- [#175488816] change welcome message (#115) [`#175488816`](https://www.pivotaltracker.com/story/show/175488816)
- chore: release 1.31.0 [`84013f1`](https://github.com/pagopa/io-functions-app/commit/84013f123757f51cabb5f784f08d3535a3f94a4d)

## 1.30.1

### Patch Changes

> 19 November 2020

- Add mail common module [`#114`](https://github.com/pagopa/io-functions-app/pull/114)
- chore: release 1.30.1 [`d8a5b40`](https://github.com/pagopa/io-functions-app/commit/d8a5b40b7f41237fc53230db810e658f07c09da4)

## 1.30.0

### Minor Changes

> 30 October 2020

- [#175434645] Allow users to abort a DELETE request [`#113`](https://github.com/pagopa/io-functions-app/pull/113)
- [#175434645] Allow users to abort a DELETE request (#113) [`#175434645`](https://www.pivotaltracker.com/story/show/175434645)
- chore: release 1.30.0 [`597853f`](https://github.com/pagopa/io-functions-app/commit/597853ffbb3b0e1f8594592fe04b302cad5fdee5)

## 1.29.1

### Patch Changes

> 28 October 2020

- remove unused config key [`#112`](https://github.com/pagopa/io-functions-app/pull/112)
- chore: release 1.29.1 [`81bc4cf`](https://github.com/pagopa/io-functions-app/commit/81bc4cfed9a0b3d23e64d98b712d68bdf501727d)

## 1.29.0

### Minor Changes

> 28 October 2020

- [#175095963] Auto enable Inbox and Webhook on profile update [`#109`](https://github.com/pagopa/io-functions-app/pull/109)
- [#175119553] Centralize environment variables in single config module [`#110`](https://github.com/pagopa/io-functions-app/pull/110)
- [#175011046] Change pipeline to staging slot [`#108`](https://github.com/pagopa/io-functions-app/pull/108)
- [#175095963] Auto enable Inbox and Webhook on profile update (#109) [`#175095963`](https://www.pivotaltracker.com/story/show/175095963)
- [#175119553] Centralize environment variables in single config module (#110) [`#175119553`](https://www.pivotaltracker.com/story/show/175119553)
- [#175011046] Change pipeline to staging slot (#108) [`#175011046`](https://www.pivotaltracker.com/story/show/175011046)
- chore: release 1.29.0 [`9cc75ad`](https://github.com/pagopa/io-functions-app/commit/9cc75ad01f5676934d676b69eb3a98a3ccc3d0dd)
- Update CODEOWNERS [`5d2821f`](https://github.com/pagopa/io-functions-app/commit/5d2821f90ab70cbc335fa02ea9e633f77d31fe4e)

## 1.28.0

### Minor Changes

> 22 September 2020

- [#174770172] Add Service metadata attributes [`#107`](https://github.com/pagopa/io-functions-app/pull/107)
- [#171554236] Update io-functions-commons to v13 [`#99`](https://github.com/pagopa/io-functions-app/pull/99)
- change subscription key header [`#106`](https://github.com/pagopa/io-functions-app/pull/106)
- externalize MAILHOG_HOSTNAME [`#100`](https://github.com/pagopa/io-functions-app/pull/100)
- [#174770172] Add Service metadata attributes (#107) [`#174770172`](https://www.pivotaltracker.com/story/show/174770172)
- [#171554236] Update io-functions-commons to v13 (#99) [`#171554236`](https://www.pivotaltracker.com/story/show/171554236)
- chore: release 1.28.0 [`b6f4671`](https://github.com/pagopa/io-functions-app/commit/b6f46719916bfa5c97e40e3768aaab1e36fa9f63)

## 1.27.0

### Minor Changes

> 29 July 2020

- fix statuses [`#98`](https://github.com/pagopa/io-functions-app/pull/98)
- [#173848228] Do not send email to DPO on user data processing request [`#97`](https://github.com/pagopa/io-functions-app/pull/97)
- [#173848228] Do not send email to DPO on user data processing request (#97) [`#173848228`](https://www.pivotaltracker.com/story/show/173848228)
- chore: release 1.27.0 [`7310c5f`](https://github.com/pagopa/io-functions-app/commit/7310c5fe0cf2dcdba8f93f92d8352167d51a2602)

## 1.26.0

### Minor Changes

> 16 July 2020

- [#173783401] Add user data processing status ABORTED [`#96`](https://github.com/pagopa/io-functions-app/pull/96)
- [#173783401] Add user data processing status ABORTED (#96) [`#173783401`](https://www.pivotaltracker.com/story/show/173783401)
- chore: release 1.26.0 [`cec8b90`](https://github.com/pagopa/io-functions-app/commit/cec8b90d99723753b55a9fc28477612d3fb82fa0)

## 1.25.0

### Minor Changes

> 20 June 2020

- [#173415193] include bonus info in welcome message [`#95`](https://github.com/pagopa/io-functions-app/pull/95)
- [#173415193] include bonus info in welcome message (#95) [`#173415193`](https://www.pivotaltracker.com/story/show/173415193)
- chore: release 1.25.0 [`d0a84c1`](https://github.com/pagopa/io-functions-app/commit/d0a84c1c45a5efa6d5c8769a8843fd686035cf5a)

## 1.24.0

### Minor Changes

> 10 June 2020

- [#173263590] fix activity return type [`#94`](https://github.com/pagopa/io-functions-app/pull/94)
- [#172973044] Adds MultiTransport support to SendValidationEmailActivity [`#93`](https://github.com/pagopa/io-functions-app/pull/93)
- [#173263590] fix activity return type (#94) [`#173263590`](https://www.pivotaltracker.com/story/show/173263590)
- [#172973044] Adds MultiTransport support to SendValidationEmailActivity (#93) [`#172973044`](https://www.pivotaltracker.com/story/show/172973044)
- chore: release 1.24.0 [`029e230`](https://github.com/pagopa/io-functions-app/commit/029e23056d377b7a2fbb98d01ce1bd33840d7107)

## 1.23.0

### Minor Changes

> 9 June 2020

- [#172877358] handle http errors in welcome messages [`#92`](https://github.com/pagopa/io-functions-app/pull/92)
- Upgrades typescript to 3.9.5 [`#91`](https://github.com/pagopa/io-functions-app/pull/91)
- [#172877358] handle http errors in welcome messages (#92) [`#172877358`](https://www.pivotaltracker.com/story/show/172877358)
- chore: release 1.23.0 [`0c89b7f`](https://github.com/pagopa/io-functions-app/commit/0c89b7f8fd799a0176117345ca30186bc53dd967)

## 1.22.0

### Minor Changes

> 6 June 2020

- [#172973106] Migrate to runtime v3 [`#90`](https://github.com/pagopa/io-functions-app/pull/90)
- [#173193265] upgrade durable function client [`#88`](https://github.com/pagopa/io-functions-app/pull/88)
- [#173182873] add retry when createOrUpdateInstallation fails [`#89`](https://github.com/pagopa/io-functions-app/pull/89)
- [#172973106] Migrate to runtime v3 (#90) [`#172973106`](https://www.pivotaltracker.com/story/show/172973106)
- [#173193265] upgrade durable function client (#88) [`#173193265`](https://www.pivotaltracker.com/story/show/173193265)
- [#173182873] add retry when createOrUpdateInstallation fails (#89) [`#173182873`](https://www.pivotaltracker.com/story/show/173182873)
- chore: release 1.22.0 [`5f622f2`](https://github.com/pagopa/io-functions-app/commit/5f622f29350894d0c16e25c8892c622283667605)

## 1.21.1

### Patch Changes

> 5 June 2020

- [#173182873] fix installation api call [`#87`](https://github.com/pagopa/io-functions-app/pull/87)
- [#173182873] fix installation api call (#87) [`#173182873`](https://www.pivotaltracker.com/story/show/173182873)
- chore: release 1.21.1 [`d323724`](https://github.com/pagopa/io-functions-app/commit/d32372436aa0d65786dc497e546160b2987c61a7)

## 1.21.0

### Minor Changes

> 4 June 2020

- throw and retry in case of errors calling notification hub [`#86`](https://github.com/pagopa/io-functions-app/pull/86)
- hotfix: do not retry in case a delete op on notificationhub fails [`9a3786d`](https://github.com/pagopa/io-functions-app/commit/9a3786dfdda2278bb727f61797d134731dffd022)
- chore: release 1.21.0 [`e885298`](https://github.com/pagopa/io-functions-app/commit/e8852981b78705fda3f2cb733cab6bbd9bb5c618)

## 1.20.1

### Patch Changes

> 23 May 2020

- chore: release 1.20.1 [`bca311a`](https://github.com/pagopa/io-functions-app/commit/bca311a798aebf7d90b6d2125e8ca56a9cf05cb6)
- hotfix: change specs path in package.json [`222877b`](https://github.com/pagopa/io-functions-app/commit/222877bbe43c2cd705191f539b9c1bf540d323f8)

## 1.20.0

### Minor Changes

> 23 May 2020

- [#172407010] Notification Hub Services externalization [`#72`](https://github.com/pagopa/io-functions-app/pull/72)
- [#172376369] hadle is_test_profile flag [`#85`](https://github.com/pagopa/io-functions-app/pull/85)
- [#172407010] Notification Hub Services externalization (#72) [`#172407010`](https://www.pivotaltracker.com/story/show/172407010)
- [#172376369] hadle is_test_profile flag (#85) [`#172376369`](https://www.pivotaltracker.com/story/show/172376369)
- hotfix: docker environment [`b195a7f`](https://github.com/pagopa/io-functions-app/commit/b195a7f65fabe5b7e7e1d011ebc67be9f3b92f1e)
- chore: release 1.20.0 [`8c46076`](https://github.com/pagopa/io-functions-app/commit/8c460763da9e123a27a6ac5901b1c2657a0f1359)

## 1.19.2

### Patch Changes

> 20 May 2020

- update io-functions-commons [`#84`](https://github.com/pagopa/io-functions-app/pull/84)
- chore: release 1.19.2 [`0213a42`](https://github.com/pagopa/io-functions-app/commit/0213a42da3f70fe3601a6837a6ab4027df5f445d)

## 1.19.1

### Patch Changes

> 20 May 2020

- upgrade openapi specs [`#83`](https://github.com/pagopa/io-functions-app/pull/83)
- hotfix: update openapi specs [`3eb4158`](https://github.com/pagopa/io-functions-app/commit/3eb4158520209d8a1951113eb1b1f8afc0113dbc)
- chore: release 1.19.1 [`7d0c241`](https://github.com/pagopa/io-functions-app/commit/7d0c24142a54bb52cd845eb3d35b050bdc18f1d1)
- hotfix: added IsTestProfile to openapi specs [`c82eb32`](https://github.com/pagopa/io-functions-app/commit/c82eb324520473b15fca89167f3da7b9fcd8132d)

## 1.19.0

### Minor Changes

> 20 May 2020

- upgrade io-fn-commons version [`#82`](https://github.com/pagopa/io-functions-app/pull/82)
- chore: release 1.19.0 [`75c0a43`](https://github.com/pagopa/io-functions-app/commit/75c0a434770782a1a00edbd7d015868222036e26)
- hotfix: add nvmrc [`e407de8`](https://github.com/pagopa/io-functions-app/commit/e407de818198244dad6d1fcf8c52fcc08a1cfbf3)

## 1.18.1

### Patch Changes

> 16 May 2020

- [#172876785] fix send welcome message activity [`#81`](https://github.com/pagopa/io-functions-app/pull/81)
- [#172876785] fix send welcome message activity (#81) [`#172876785`](https://www.pivotaltracker.com/story/show/172876785)
- chore: release 1.18.1 [`ac53361`](https://github.com/pagopa/io-functions-app/commit/ac53361f36bdd57c280b121532f1847242f64de8)

## 1.18.0

### Minor Changes

> 16 May 2020

- [#172768595] removed sender services [`#80`](https://github.com/pagopa/io-functions-app/pull/80)
- [#172768595] removed sender services (#80) [`#172768595`](https://www.pivotaltracker.com/story/show/172768595)
- chore: release 1.18.0 [`3a5a214`](https://github.com/pagopa/io-functions-app/commit/3a5a21425c467ac595343d4fc976d05a60d390c4)

## 1.17.0

### Minor Changes

> 16 May 2020

- [#172693963] - User Data Processing in progress statuses management [`#79`](https://github.com/pagopa/io-functions-app/pull/79)
- [#172734823] Add retry on SendWelcomeMessage Activity [`#78`](https://github.com/pagopa/io-functions-app/pull/78)
- [#172693963] - User Data Processing in progress statuses management (#79) [`#172693963`](https://www.pivotaltracker.com/story/show/172693963)
- [#172734823] Add retry on SendWelcomeMessage Activity (#78) [`#172734823`](https://www.pivotaltracker.com/story/show/172734823)
- chore: release 1.17.0 [`10a7c22`](https://github.com/pagopa/io-functions-app/commit/10a7c22cc2b0423fdbb71a52471761ac0ba51e7f)
- hotfix: missing return type in userdataprocessing api specs [`20735d2`](https://github.com/pagopa/io-functions-app/commit/20735d2e1cf7b57f3b82f51f773f157ea3357d23)

## 1.16.0

### Minor Changes

> 4 May 2020

- updated io-functions-commons version [`#76`](https://github.com/pagopa/io-functions-app/pull/76)
- hotfix: removed superagent (unused package) [`74aa1dc`](https://github.com/pagopa/io-functions-app/commit/74aa1dc8c7d188130fee4f5f293c617a3a22ad07)
- chore: release 1.16.0 [`322292d`](https://github.com/pagopa/io-functions-app/commit/322292d55491930934a2ee8c1086cff711196593)

## 1.15.0

### Minor Changes

> 26 April 2020

- [#172514954] add timeout to mailup calls [`#75`](https://github.com/pagopa/io-functions-app/pull/75)
- [#172514954] add timeout to mailup calls (#75) [`#172514954`](https://www.pivotaltracker.com/story/show/172514954)
- hotfix: fix mail transport [`886faef`](https://github.com/pagopa/io-functions-app/commit/886faef5e420acab4d001304ac60cae4a2a17213)
- hotfix: abort controller [`3aeb18e`](https://github.com/pagopa/io-functions-app/commit/3aeb18eb0d1c3d5e4e8cfa5e7cf37b8ad2740ffd)
- chore: release 1.15.0 [`cb85de4`](https://github.com/pagopa/io-functions-app/commit/cb85de4415cb5c6f09533297ed6cc447e7f4ff07)

## 1.14.0

### Minor Changes

> 25 April 2020

- Adds sendgrid transport [`#74`](https://github.com/pagopa/io-functions-app/pull/74)
- [#172435256] Use commons fetch for MailUP API [`#73`](https://github.com/pagopa/io-functions-app/pull/73)
- Use commons fetch client when calling functions-services [`#71`](https://github.com/pagopa/io-functions-app/pull/71)
- [#172405623] fix typo in welcome message [`#70`](https://github.com/pagopa/io-functions-app/pull/70)
- [#172435256] Use commons fetch for MailUP API (#73) [`#172435256`](https://www.pivotaltracker.com/story/show/172435256)
- [#172405623] fix typo in welcome message (#70) [`#172405623`](https://www.pivotaltracker.com/story/show/172405623)
- chore: release 1.14.0 [`8b42b84`](https://github.com/pagopa/io-functions-app/commit/8b42b8444a43fe5e91358dfc4058bbced6eee3a9)

## 1.13.0

### Minor Changes

> 19 April 2020

- [#172397261] make application insights configurable [`#69`](https://github.com/pagopa/io-functions-app/pull/69)
- [#172397261] make application insights configurable (#69) [`#172397261`](https://www.pivotaltracker.com/story/show/172397261)
- chore: release 1.13.0 [`d457580`](https://github.com/pagopa/io-functions-app/commit/d4575802fe89c69523b4086823153d17b1ebb403)

## 1.12.4

### Patch Changes

> 19 April 2020

- [#172332575] fix cosmosdb singleton [`#68`](https://github.com/pagopa/io-functions-app/pull/68)
- [#172332575] fix cosmosdb singleton (#68) [`#172332575`](https://www.pivotaltracker.com/story/show/172332575)
- chore: release 1.12.4 [`e2abebb`](https://github.com/pagopa/io-functions-app/commit/e2abebbf478cb507457cd0492bc8bb869430a430)

## 1.12.3

### Patch Changes

> 18 April 2020

- chore: release 1.12.3 [`1581ae6`](https://github.com/pagopa/io-functions-app/commit/1581ae6dfc1a90673f7bb7c858a5123e58aa685b)
- hoftix: fix eager function call [`b913bf3`](https://github.com/pagopa/io-functions-app/commit/b913bf3d89913187c188660de930e9455a038190)

## 1.12.2

### Patch Changes

> 18 April 2020

- hotfix: add fiscal code to logs [`c41830a`](https://github.com/pagopa/io-functions-app/commit/c41830a6ae76be0c3025de521bce0a4183f14c5c)
- chore: release 1.12.2 [`937d109`](https://github.com/pagopa/io-functions-app/commit/937d10996b1380af8e6305a6de04ea7e1f7618c0)

## 1.12.1

### Patch Changes

> 18 April 2020

- hotfix: broken link [`875e0c1`](https://github.com/pagopa/io-functions-app/commit/875e0c1103a7d635958b02130a8642c4f5fc5657)
- chore: release 1.12.1 [`034d06c`](https://github.com/pagopa/io-functions-app/commit/034d06c76ab88851212b5ca8c20e90cd26267c1d)

## 1.12.0

### Minor Changes

> 18 April 2020

- [#172332575] singleton cosmosdb client [`#67`](https://github.com/pagopa/io-functions-app/pull/67)
- [#172332575] singleton cosmosdb client (#67) [`#172332575`](https://www.pivotaltracker.com/story/show/172332575)
- chore: release 1.12.0 [`d142442`](https://github.com/pagopa/io-functions-app/commit/d14244248bbfe66371d8344ecf24058b2d640db1)

## 1.11.0

### Minor Changes

> 18 April 2020

- [#172367272] remove winston logger [`#66`](https://github.com/pagopa/io-functions-app/pull/66)
- [#172380989] Add html body to DPO's UserDataProcessing email [`#65`](https://github.com/pagopa/io-functions-app/pull/65)
- [#172376654] fix broken image link [`#64`](https://github.com/pagopa/io-functions-app/pull/64)
- [#172332575] singleton cosmosdb client [`#172332575`](https://www.pivotaltracker.com/story/show/172332575)
- [#172367272] remove winston logger (#66) [`#172367272`](https://www.pivotaltracker.com/story/show/172367272)
- [#172380989] Add html body to DPO's UserDataProcessing email (#65) [`#172380989`](https://www.pivotaltracker.com/story/show/172380989)
- [#172376654] fix broken image link (#64) [`#172376654`](https://www.pivotaltracker.com/story/show/172376654)
- chore: release 1.11.0 [`da48643`](https://github.com/pagopa/io-functions-app/commit/da48643e56e7ac4f6fbf6349a06092750e613765)
- adds comment [`c7c5450`](https://github.com/pagopa/io-functions-app/commit/c7c54501a2ae07f3ed97f30c2b05ebd2a9d955d2)

## 1.10.0

### Minor Changes

> 17 April 2020

- [#172078979] Add encryption to SPID logs payload [`#57`](https://github.com/pagopa/io-functions-app/pull/57)
- Bump https-proxy-agent from 2.2.2 to 2.2.4 [`#63`](https://github.com/pagopa/io-functions-app/pull/63)
- [#172161469] send email to DPO for each data processing request [`#61`](https://github.com/pagopa/io-functions-app/pull/61)
- [#172078979] Add encryption to SPID logs payload (#57) [`#172078979`](https://www.pivotaltracker.com/story/show/172078979)
- [#172161469] send email to DPO for each data processing request (#61) [`#172161469`](https://www.pivotaltracker.com/story/show/172161469)
- chore: release 1.10.0 [`0264dbf`](https://github.com/pagopa/io-functions-app/commit/0264dbf38c146f600df347a6206e3099a03fc10d)

## 1.9.0

### Minor Changes

> 14 April 2020

- [#172308410] refactor StoreSpidLogs and track with Application Insights [`#62`](https://github.com/pagopa/io-functions-app/pull/62)
- [#172308410] refactor StoreSpidLogs and track with Application Insights (#62) [`#172308410`](https://www.pivotaltracker.com/story/show/172308410)
- hotfix: change logging level from trace to information [`5a2154a`](https://github.com/pagopa/io-functions-app/commit/5a2154ab12e526358fa80e34140da48ca839b62d)
- chore: release 1.9.0 [`d20ec3b`](https://github.com/pagopa/io-functions-app/commit/d20ec3b764d68b05a03f316a4057cb9a31f03d38)

## 1.8.0

### Minor Changes

> 12 April 2020

- chore: release 1.8.0 [`c516054`](https://github.com/pagopa/io-functions-app/commit/c516054b5068944e5485a5aa3ff9572d261883ff)

## 1.7.0

### Minor Changes

> 8 April 2020

- [#172123296] pipeline support to deploy using staging slot [`#59`](https://github.com/pagopa/io-functions-app/pull/59)
- [#172101760] remove refs to "beta" in welcome message [`#58`](https://github.com/pagopa/io-functions-app/pull/58)
- [#169692181] fix api specs, add conflict states [`#169692181`](https://www.pivotaltracker.com/story/show/169692181)
- [#172123296] minor change to pipeline displayName [`#172123296`](https://www.pivotaltracker.com/story/show/172123296)
- [#172123296] pipeline support to deploy using staging slot (#59) [`#172123296`](https://www.pivotaltracker.com/story/show/172123296)
- [#172101760] remove refs to "beta" in welcome message (#58) [`#172101760`](https://www.pivotaltracker.com/story/show/172101760)
- chore: release 1.7.0 [`bdcbc67`](https://github.com/pagopa/io-functions-app/commit/bdcbc67ab733c79dbb04a32c375b80114b535e18)
- [pipeline] add variable CACHE_VERSION_ID [`6ef9601`](https://github.com/pagopa/io-functions-app/commit/6ef9601fd5a2860c79a1a087815741d49340fc2c)
- [pipeline] run some jobs on linux [`bb9ad40`](https://github.com/pagopa/io-functions-app/commit/bb9ad40872d2ade90ae4fa87032d1daf84dcd5ce)

## 1.6.1

### Patch Changes

> 31 March 2020

- chore: release 1.6.1 [`58a9738`](https://github.com/pagopa/io-functions-app/commit/58a9738942ce45f0b8db492abae765af00d68a22)
- hotifx: fix env variable names [`84a2c6c`](https://github.com/pagopa/io-functions-app/commit/84a2c6c80f0533935fd49d1e60fdba4250850632)

## 1.6.0

> 31 March 2020

- refactor of SpidMsg's structure [`#56`](https://github.com/pagopa/io-functions-app/pull/56)
- [pipeline] Update azure-pipelines.yml for Danger [`a8dd3eb`](https://github.com/pagopa/io-functions-app/commit/a8dd3eb07766d1bba7746064b62ba785715f7119)
- chore: release 1.6.0 [`31f4d70`](https://github.com/pagopa/io-functions-app/commit/31f4d7027940d62f337a7f276827c092632e1ba7)
- [skip ci] Added task UseNode@1 in pipeline [`49930d7`](https://github.com/pagopa/io-functions-app/commit/49930d79d7d12070d1a937c2475ee73fe1261944)

## 1.5.0

### Minor Changes

> 25 March 2020

- [#158818736] Add SPID login audit log [`#51`](https://github.com/pagopa/io-functions-app/pull/51)
- [#158818736] Add SPID login audit log (#51) [`#158818736`](https://www.pivotaltracker.com/story/show/158818736)
- chore: release 1.5.0 [`5393074`](https://github.com/pagopa/io-functions-app/commit/539307450e98c85a7dedc6bea79ac8629cbe449d)

## 1.4.0

### Minor Changes

> 23 March 2020

- [#171558851] modify welcome message [`#55`](https://github.com/pagopa/io-functions-app/pull/55)
- [#171558851] modify welcome message (#55) [`#171558851`](https://www.pivotaltracker.com/story/show/171558851)
- chore: release 1.4.0 [`513fa05`](https://github.com/pagopa/io-functions-app/commit/513fa054e2504204639b0ed724a3bc991f1950be)

## 1.3.0

### Minor Changes

> 19 March 2020

- [#171879551] delete backend status cache [`#54`](https://github.com/pagopa/io-functions-app/pull/54)
- [#171879551] delete backend status cache (#54) [`#171879551`](https://www.pivotaltracker.com/story/show/171879551)
- chore: release 1.3.0 [`34f0e1d`](https://github.com/pagopa/io-functions-app/commit/34f0e1d9a37ee5cdadc0f0bc0b2ac456dae3c90b)

## 1.2.0

### Minor Changes

> 18 March 2020

- [#171854758] fix refresh time in stauts cache [`#53`](https://github.com/pagopa/io-functions-app/pull/53)
- [#171179889] fix StoreBackendStatus [`#52`](https://github.com/pagopa/io-functions-app/pull/52)
- hotfix: change StoreBackendStatus refresh interval [`#50`](https://github.com/pagopa/io-functions-app/pull/50)
- [#171179889] fix StoreBackendStatus entrypoint [`#49`](https://github.com/pagopa/io-functions-app/pull/49)
- [#171179889] fix path name for backend status function [`#48`](https://github.com/pagopa/io-functions-app/pull/48)
- [#171179889] add backend status check [`#47`](https://github.com/pagopa/io-functions-app/pull/47)
- [#171854758] fix refresh time in stauts cache (#53) [`#171854758`](https://www.pivotaltracker.com/story/show/171854758)
- [#171179889] fix StoreBackendStatus (#52) [`#171179889`](https://www.pivotaltracker.com/story/show/171179889)
- [#171179889] fix StoreBackendStatus entrypoint (#49) [`#171179889`](https://www.pivotaltracker.com/story/show/171179889)
- [#171179889] fix path name for backend status function (#48) [`#171179889`](https://www.pivotaltracker.com/story/show/171179889)
- [#171179889] add backend status check (#47) [`#171179889`](https://www.pivotaltracker.com/story/show/171179889)
- chore: release 1.2.0 [`16f37a4`](https://github.com/pagopa/io-functions-app/commit/16f37a4f8ae9e509f8064425639be739b35d04ac)

## 1.1.0

### Minor Changes

> 14 March 2020

- [#171800016] Use appsettings instead of connectionstrings [`#46`](https://github.com/pagopa/io-functions-app/pull/46)
- [#171211343] Fix user data processing API status updates [`#45`](https://github.com/pagopa/io-functions-app/pull/45)
- [#171752912] fix subscription feed generation [`#44`](https://github.com/pagopa/io-functions-app/pull/44)
- [#171643507] fix subscription feed update [`#43`](https://github.com/pagopa/io-functions-app/pull/43)
- [#171800016] Use appsettings instead of connectionstrings (#46) [`#171800016`](https://www.pivotaltracker.com/story/show/171800016)
- [#171211343] Fix user data processing API status updates (#45) [`#171211343`](https://www.pivotaltracker.com/story/show/171211343)
- [#171752912] fix subscription feed generation (#44) [`#171752912`](https://www.pivotaltracker.com/story/show/171752912)
- [#171643507] fix subscription feed update (#43) [`#171643507`](https://www.pivotaltracker.com/story/show/171643507)
- chore: release 1.1.0 [`0a0fe57`](https://github.com/pagopa/io-functions-app/commit/0a0fe57b4dfeda8781d84a4822b7ec583cd2d300)

### 1.0.0

> 5 March 2020

- [#171211343]-user data processing api [`#42`](https://github.com/pagopa/io-functions-app/pull/42)
- [#171549853] Added azure devops pipeline [`#41`](https://github.com/pagopa/io-functions-app/pull/41)
- [#171211343]-user data processing api (#42) [`#171211343`](https://www.pivotaltracker.com/story/show/171211343)
- [#171549853] Added azure devops pipeline (#41) [`#171549853`](https://www.pivotaltracker.com/story/show/171549853)
- chore: release 1.0.0 [`8683871`](https://github.com/pagopa/io-functions-app/commit/86838717645bfe071137a0c9596021a026e25e2d)

## 0.9.0

### Minor Changes

> 2 March 2020

- [#171211343] - user data processing api [`#40`](https://github.com/pagopa/io-functions-app/pull/40)
- [#171211343] - user data processing api (#40) [`#171211343`](https://www.pivotaltracker.com/story/show/171211343)
- chore: release 0.9.0 [`c9b3cad`](https://github.com/pagopa/io-functions-app/commit/c9b3cad9d5419eec1b8b9e5ef2794fc1d600dd8b)

## 0.8.0

### Minor Changes

> 26 February 2020

- [#171211343] Add user data processing API [`#39`](https://github.com/pagopa/io-functions-app/pull/39)
- [#171211343] Add user data processing API (#39) [`#171211343`](https://www.pivotaltracker.com/story/show/171211343)
- chore: release 0.8.0 [`5e336be`](https://github.com/pagopa/io-functions-app/commit/5e336be3833858a10e4ca82a94b960d7fb293199)

## 0.7.1

### Patch Changes

> 20 February 2020

- [#171378204] fix service metadata [`#38`](https://github.com/pagopa/io-functions-app/pull/38)
- [#171378204] fix service metadata (#38) [`#171378204`](https://www.pivotaltracker.com/story/show/171378204)
- chore: release 0.7.1 [`8f02a9e`](https://github.com/pagopa/io-functions-app/commit/8f02a9ea6b3783d22a11648c9144cb916ce1d43e)

## 0.7.0

### Minor Changes

> 20 February 2020

- [#171377847] adds release it [`#36`](https://github.com/pagopa/io-functions-app/pull/36)
- [#171312722] adds service_metadata to ServicePublic [`#35`](https://github.com/pagopa/io-functions-app/pull/35)
- Bump handlebars from 4.1.2 to 4.5.3 [`#34`](https://github.com/pagopa/io-functions-app/pull/34)
- [#171377847] add release-it package [`#171377847`](https://www.pivotaltracker.com/story/show/171377847)
- [#171377847] adds release it (#36) [`#171377847`](https://www.pivotaltracker.com/story/show/171377847)
- [#171312722] adds service_metadata to ServicePublic (#35) [`#171312722`](https://www.pivotaltracker.com/story/show/171312722)
- chore: release 0.7.0 [`c38bdad`](https://github.com/pagopa/io-functions-app/commit/c38bdadb8595423341eed470ea8905ce81264928)

## 0.6.7

### Patch Changes

> 12 March 2020

- [#171752912] fix subscription feed generation [`#171752912`](https://www.pivotaltracker.com/story/show/171752912)

## 0.6.6

### Patch Changes

> 10 March 2020

- [#171643507] fix subscription feed update [`#171643507`](https://www.pivotaltracker.com/story/show/171643507)

## 0.6.5

### Patch Changes

> 18 December 2019

- [#170333232] Retrieve message content from blob (no attachment) [`#33`](https://github.com/pagopa/io-functions-app/pull/33)
- [#170358302] Update io-functions-commons to v1.6.1 [`#32`](https://github.com/pagopa/io-functions-app/pull/32)
- [#170333232] Retrieve message content from blob (no attachment) (#33) [`#170333232`](https://www.pivotaltracker.com/story/show/170333232)
- [#170358302] Update io-functions-commons to v1.6.1 (#32) [`#170358302`](https://www.pivotaltracker.com/story/show/170358302)

## 0.6.4

### Patch Changes

> 10 December 2019

- [#170133263] Create ValidationTokens storage table if not exists [`#31`](https://github.com/pagopa/io-functions-app/pull/31)
- [#170133263] Create ValidationTokens storage table if not exists (#31) [`#170133263`](https://www.pivotaltracker.com/story/show/170133263)

## 0.6.3

### Patch Changes

> 4 December 2019

- [#170016186] Update validation email template [`#29`](https://github.com/pagopa/io-functions-app/pull/29)
- [#170016186] Update validation email template (#29) [`#170016186`](https://www.pivotaltracker.com/story/show/170016186) [`#170016186`](https://www.pivotaltracker.com/story/show/170016186) [`#170016186`](https://www.pivotaltracker.com/story/show/170016186) [`#170016186`](https://www.pivotaltracker.com/story/show/170016186)

## 0.6.2

### Patch Changes

> 18 November 2019

- [#169810481] Revert getservicesbyrecipient [`#26`](https://github.com/pagopa/io-functions-app/pull/26)
- [#169810481] Revert getservicesbyrecipient (#26) [`#169810481`](https://www.pivotaltracker.com/story/show/169810481)

## 0.6.1

### Patch Changes

> 18 November 2019

- [#169810481] Fix OpenAPI startEmailValidationProcess path [`#25`](https://github.com/pagopa/io-functions-app/pull/25)
- [#169810481] Fix OpenAPI startEmailValidationProcess path (#25) [`#169810481`](https://www.pivotaltracker.com/story/show/169810481)

## 0.6.0

### Minor Changes

> 18 November 2019

- [#168821506] Email validation process [`#24`](https://github.com/pagopa/io-functions-app/pull/24)
- [#168821506] Email validation process (#24) [`#168821506`](https://www.pivotaltracker.com/story/show/168821506) [`#168821506`](https://www.pivotaltracker.com/story/show/168821506) [`#168821506`](https://www.pivotaltracker.com/story/show/168821506) [`#168821506`](https://www.pivotaltracker.com/story/show/168821506) [`#168821506`](https://www.pivotaltracker.com/story/show/168821506)

## 0.5.0

### Minor Changes

> 15 November 2019

- [#169785262] Fix profile create and update [`#23`](https://github.com/pagopa/io-functions-app/pull/23)
- [#169785262] Fix profile create and update (#23) [`#169785262`](https://www.pivotaltracker.com/story/show/169785262)
- Create CODEOWNERS [`61ec7d7`](https://github.com/pagopa/io-functions-app/commit/61ec7d73d8e04dc2109b40231c2483ca2fd869cf)

## 0.4.0

### Minor Changes

> 11 November 2019

- [#169674172] Add available_notification_channels to ServicePublic [`#22`](https://github.com/pagopa/io-functions-app/pull/22)
- [#169674172] Add available_notification_channels to ServicePublic (#22) [`#169674172`](https://www.pivotaltracker.com/story/show/169674172)

## 0.3.0

### Minor Changes

> 4 November 2019

- [#168821506] New Profile with is_email_validated field [`#21`](https://github.com/pagopa/io-functions-app/pull/21)
- [#168779814] Add extensionBundle [`#18`](https://github.com/pagopa/io-functions-app/pull/18)
- [#168719805] Update io-functions-commons version [`#17`](https://github.com/pagopa/io-functions-app/pull/17)
- Update io-functions-commons version [`#16`](https://github.com/pagopa/io-functions-app/pull/16)
- Set custom hubName [`#15`](https://github.com/pagopa/io-functions-app/pull/15)
- [#168350662] Check that blockedInboxOrChannels is an object [`#14`](https://github.com/pagopa/io-functions-app/pull/14)
- [#168133214] Finishing up subscriptions feed feature [`#12`](https://github.com/pagopa/io-functions-app/pull/12)
- [#168821506] New Profile with is_email_validated field (#21) [`#168821506`](https://www.pivotaltracker.com/story/show/168821506)
- [#168779814] Add extensionBundle (#18) [`#168779814`](https://www.pivotaltracker.com/story/show/168779814)
- [#168719805] Update io-functions-commons version (#17) [`#168719805`](https://www.pivotaltracker.com/story/show/168719805)
- [#168350662] Check that blockedInboxOrChannels is an object (#14) [`#168350662`](https://www.pivotaltracker.com/story/show/168350662)
- [#166536717] Typo error in welcome message [`#166536717`](https://www.pivotaltracker.com/story/show/166536717)
- [#168133214] Finishing up subscriptions feed feature (#12) [`#168133214`](https://www.pivotaltracker.com/story/show/168133214)
- Upgrades typescript to 3.6.2 [`a1925e0`](https://github.com/pagopa/io-functions-app/commit/a1925e0c61057e31ea4a2396a760ec8824aab874)

## 0.2.1

### Patch Changes

> 6 September 2019

- [#16813321] Fixes hash creation [`#16813321`](https://www.pivotaltracker.com/story/show/16813321)

## 0.2.0

### Minor Changes

> 3 September 2019

- [#16813321] Stores subscription events for services and profiles [`#11`](https://github.com/pagopa/io-functions-app/pull/11)
- [#16813321] Stores subscription events for services and profiles (#11) [`#16813321`](https://www.pivotaltracker.com/story/show/16813321)
- Adds deploy script [`3c4c1b0`](https://github.com/pagopa/io-functions-app/commit/3c4c1b0b8c9aa74a91e2c2bd6c2187d1fc3a9ac1)

## 0.1.0

### Minor Changes

> 26 August 2019

- [#166672376] Upgrades io-functions-commons to support IsEmailEnabled flag [`#10`](https://github.com/pagopa/io-functions-app/pull/10)
- [#166672376] Upgrades io-functions-commons to support IsEmailEnabled flag (#10) [`#166672376`](https://www.pivotaltracker.com/story/show/166672376)

#### v0.0.1

### Patch Changes

> 23 August 2019

- Remove cors and other unused packages [`#9`](https://github.com/pagopa/io-functions-app/pull/9)
- Adds GetMessages [`#8`](https://github.com/pagopa/io-functions-app/pull/8)
- Adds GetMessage [`#7`](https://github.com/pagopa/io-functions-app/pull/7)
- Fixes UpdatedProfileOrchestrator [`#6`](https://github.com/pagopa/io-functions-app/pull/6)
- Adds UpsertProfile function and async activities [`#5`](https://github.com/pagopa/io-functions-app/pull/5)
- Adds GetProfile function [`#4`](https://github.com/pagopa/io-functions-app/pull/4)
- Adds GetVisibleServices handler [`#3`](https://github.com/pagopa/io-functions-app/pull/3)
- Adds GetServicesForRecipient function [`#2`](https://github.com/pagopa/io-functions-app/pull/2)
- Adds GetService function [`#1`](https://github.com/pagopa/io-functions-app/pull/1)
- First commit [`ca8860b`](https://github.com/pagopa/io-functions-app/commit/ca8860bc656eda52e82c0643c0b7dcd3ca55e8de)
- Make GetService handle only GET requests [`9a80da3`](https://github.com/pagopa/io-functions-app/commit/9a80da3e07adca600570074e4986ca3580808eef)
