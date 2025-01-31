openapi: 3.0.1
info:
  version: 5.19.0
  title: IO Profile Function API
  x-logo:
    url: https://io.italia.it/assets/img/io-logo-blue.svg
  description: |
    Documentation of the IO Profile Function API here.
servers:
  - url: https://${host}/${basePath}
security:
  - ApiKeyAuth: []
paths:
  /profiles/{fiscal_code}:
    get:
      operationId: getProfile
      summary: GetProfile
      description: Retrieve a user profile
      tags:
        - restricted
      parameters:
        - $ref: "#/components/parameters/FiscalCode"
      responses:
        "200":
          description: Profile created
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/ExtendedProfile"
        "400":
          description: Invalid request.
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/ProblemJson"
        "401":
          description: Unauthorized
        "403":
          description: Forbidden
        "404":
          description: No message found.
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/ProblemJson"
        "429":
          description: Too many requests
        "500":
          description: Server Error
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/ProblemJson"
  /profiles/sanitize_email:
    post:
      operationId: sanitizeProfileEmail
      summary: SanitizeProfileEmail
      description: Sanitize Profile Email
      tags:
        - restricted
      requestBody:
        description: Profile details to be sanitized
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/SanitizeProfileEmailRequest'
        required: true
      responses:
        "202":
          description: Sanitize Request Accepted
        "400":
          description: Invalid request.
        "401":
          description: Unauthorized
        "403":
          description: Forbidden
        "404":
          description: No message found.
        "429":
          description: Too many requests
        "500":
          description: Server Error
components:
  securitySchemes:
    ApiKeyAuth:
      type: apiKey
      in: header
      name: Ocp-Apim-Subscription-Key
  parameters:
    FiscalCode:
      name: fiscal_code
      in: path
      required: true
      description: The fiscal code of the user, all upper case.
      schema:
        type: string
        maxLength: 16
        minLength: 16
        pattern: >-
          [A-Z]{6}[0-9LMNPQRSTUV]{2}[ABCDEHLMPRST][0-9LMNPQRSTUV]{2}[A-Z][0-9LMNPQRSTUV]{3}[A-Z]
        x-example: SPNDNL80R13C555X
  schemas:
    ExtendedProfile:
      description: |-
        Describes the citizen's profile, mostly interesting for preferences
        attributes.
      type: object
      properties:
        email:
          $ref: "#/components/schemas/EmailAddress"
        service_preferences_settings:
          $ref: "#/components/schemas/ServicePreferencesSettings"
        blocked_inbox_or_channels:
          $ref: "#/components/schemas/BlockedInboxOrChannels"
        preferred_languages:
          $ref: "#/components/schemas/PreferredLanguages"
        is_inbox_enabled:
          $ref: "#/components/schemas/IsInboxEnabled"
        accepted_tos_version:
          $ref: "#/components/schemas/AcceptedTosVersion"
        is_webhook_enabled:
          $ref: "#/components/schemas/IsWebhookEnabled"
        is_email_enabled:
          $ref: "#/components/schemas/IsEmailEnabled"
        is_email_validated:
          $ref: "#/components/schemas/IsEmailValidated"
        is_email_already_taken:
          type: boolean
          default: false
          description: |-
            True if the user email has been validated by another user.
            If so, the user must provide a new email.
        reminder_status:
          $ref: "#/components/schemas/ReminderStatus"
        is_test_profile:
          $ref: "#/components/schemas/IsTestProfile"
        last_app_version:
          $ref: "#/components/schemas/AppVersion"
        push_notifications_content_type:
          $ref: "#/components/schemas/PushNotificationsContentType"
        version:
          type: integer
      required:
        - is_email_enabled
        - is_email_validated
        - is_email_already_taken
        - is_inbox_enabled
        - is_webhook_enabled
        - service_preferences_settings
        - version
    EmailAddress:
      type: string
      format: email
      example: foobar@example.com
    ServicePreferencesSettings:
      description: |-
        Describes the citizen's profile, mostly interesting for preferences
        attributes.
      type: object
      properties:
        mode:
          $ref: "#/components/schemas/ServicesPreferencesMode"
      required:
        - mode
    ServicesPreferencesMode:
      type: string
      enum:
        - LEGACY
        - AUTO
        - MANUAL
    BlockedInboxOrChannel:
      type: string
      description: |-
        All notification channels plus the message inbox.
        These represent all the possible channels a user could block.
      x-extensible-enum:
        - EMAIL
        - INBOX
        - WEBHOOK
      example: INBOX
    BlockedInboxOrChannels:
      type: object
      additionalProperties:
        type: array
        items:
          $ref: "#/components/schemas/BlockedInboxOrChannel"
      description: |-
        All the notification channels blocked by the user.
        Each channel is related to a specific service (sender).
    PreferredLanguages:
      type: array
      items:
        $ref: "#/components/schemas/PreferredLanguage"
      description: >-
        Indicates the User's preferred written or spoken languages in order

        of preference. Generally used for selecting a localized User interface.
        Valid

        values are concatenation of the ISO 639-1 two letter language code, an
        underscore,

        and the ISO 3166-1 2 letter country code; e.g., 'en_US' specifies the
        language

        English and country US.
    PreferredLanguage:
      type: string
      x-extensible-enum:
        - it_IT
        - en_GB
        - es_ES
        - de_DE
        - fr_FR
      example: it_IT
    IsInboxEnabled:
      type: boolean
      description: |-
        True if the recipient of a message wants to store its content for
        later retrieval.
    AcceptedTosVersion:
      type: number
      minimum: 1
      description: Version of latest terms of service accepted by the user.
    IsWebhookEnabled:
      type: boolean
      description: >-
        True if the recipient of a message wants to forward the notifications to
        the default webhook.
    IsEmailValidated:
      type: boolean
      description: True if the user email has been validated.
    IsEmailEnabled:
      type: boolean
      description: >-
        True if the recipient of a message wants to forward the notifications to
        his email address.
    ReminderStatus:
      type: string
      x-extensible-enum:
        - ENABLED
        - DISABLED
      example: ENABLED
      description: Api definition of reminder opt-in status
    IsTestProfile:
      type: boolean
      description: True if the user's profile is only for test purpose.
      default: false
    AppVersion:
      type: string
      pattern: ^((0|[1-9]\\d*)\\.){2}(0|[1-9]\\d*)(\\.(0|[1-9]\\d*)){0,1}$
      description: A string field in Semantic Versioning format
      example: 1.10.11
    PushNotificationsContentType:
      type: string
      x-extensible-enum:
        - FULL
        - ANONYMOUS
      example: FULL
      description: >-
        This parameter specifies how a specific user wants to visualize push
        notifications.

        FULL leads to descriptive push notifications while ANONYMOUS leads to
        silent ones.
    SanitizeProfileEmailRequest:
      type: object
      properties:
        email:
          $ref: "#/components/schemas/EmailAddress"
        fiscalCode:
          $ref: "#/components/schemas/FiscalCode"
      required:
        - email
        - fiscalCode
    FiscalCode:
      description: The fiscal code of the user, all upper case.
      type: string
      maxLength: 16
      minLength: 16
      pattern: >-
        [A-Z]{6}[0-9LMNPQRSTUV]{2}[ABCDEHLMPRST][0-9LMNPQRSTUV]{2}[A-Z][0-9LMNPQRSTUV]{3}[A-Z]
      x-example: SPNDNL80R13C555X
    ProblemJson:
      type: object
      properties:
        type:
          type: string
          format: uri
          description: |-
            An absolute URI that identifies the problem type. When dereferenced,
            it SHOULD provide human-readable documentation for the problem type
            (e.g., using HTML).
          default: about:blank
          example: https://example.com/problem/constraint-violation
        title:
          type: string
          description: |-
            A short, summary of the problem type. Written in english and readable
            for engineers (usually not suited for non technical stakeholders and
            not localized); example: Service Unavailable
        status:
          type: integer
          format: int32
          description: >-
            The HTTP status code generated by the origin server for this
            occurrence

            of the problem.
          minimum: 100
          maximum: 600
          exclusiveMaximum: true
          example: 200
        detail:
          type: string
          description: |-
            A human readable explanation specific to this occurrence of the
            problem.
          example: There was an error processing the request
        instance:
          type: string
          format: uri
          description: >-
            An absolute URI that identifies the specific occurrence of the
            problem.

            It may or may not yield further information if dereferenced.
