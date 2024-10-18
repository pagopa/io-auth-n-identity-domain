## What is this
This project aims to facilitate the making of a request that follows the PagoPA S.p.A. Proof of Possession 
protocol(codename lollipop) rules. With an interactive cli and some utility methods this can be achievable.

**NOTE**: **This project it's in highly experimental state.**

## How do I use it?
You can either import the lollipop utility methods or interact with the cli command `lollipop-cli`.
The cli also supports arguments instead of a prompt-based interaction. 
For example, the following argument will skip the first prompt:

```bash
lollipop-cli --flow Sign
```

## Supported Flows
### Key pair generation
This flow lets you create a key pair based on an algorithm supported by the protocol.
The two choices are:
* NIST P-256
* RSA

The output contains:
* The JWK plain objects
* The base64url encoded representation of both keys
* The thumbprint of the public key(using sha-256)


#### Example of Key generation Flow through cli arguments
```bash
lollipop-cli --flow KeyPairCreation --algorithm ES256
```

### Sign
The sign flow lets you provide a lot of parameters to feed a sign request to a lollipop consumer.
**NOTE**: the lollipop consumer custom integration may require or ignore some parameters(like nonce and/or body parameter sign)
The output of this flow is an object with the following fields:
* digest(optional)
* signature
* signatureInput

You can however decide to ouput a curl compatible shell command almost ready to go(the only missing part is the authorization token obtained by the backend).

Video example:

https://github.com/arcogabbo/lollipop-cli/assets/22002572/0dd3ea95-3c41-4ccb-a565-dc3b1002f0af

#### Example of Sign Flow through cli arguments
```bash
lollipop-cli --flow Sign --x-pagopa-lollipop-method <METHOD> \
--x-pagopa-lollipop-original-url <URL> \
--x-pagopa-lollipop-user-id <USER_FISCAL_CODE> \
--x-pagopa-lollipop-assertion-type SAML \
--hasCustomKeyPair true --hasBody <TRUE_OR_FALSE> --hasNonce <TRUE_OR_FALSE> \
--CustomKeyPair <BASE64URL_ENCODED_PUBLIC_KEY_JWK>#<BASE64URL_ENCODED_PRIVATE_KEY_JWK> \
--outputToCurl true
```

#### Login
TODO

### Run the cli locally for development
With `npm link` or `yarn link` you can make the command available locally via `lollipop-cli`. 
Another option is to just run the script `dev-cli` included in the `package.json` with the package manager of your choice.

## TODO
- More unit tests
- Remove casting from JSON to JWK utility method when presenting custom key pair
