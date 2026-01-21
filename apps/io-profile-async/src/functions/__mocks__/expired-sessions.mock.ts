/* sonarjs/no-duplicate-string */
export const aValidationError = [
  {
    value: "AAAAAA89S20I111Y_",
    context: [
      {
        key: "",
        type: {
          name: "IRetrievedSessionNotifications",
          type: {
            name:
              '({ id: string that matches the pattern "^[A-Z]{6}[0-9LMNPQRSTUV]{2}[ABCDEHLMPRST][0-9LMNPQRSTUV]{2}[A-Z][0-9LMNPQRSTUV]{3}[A-Z]$", expiredAt: number, notificationEvents: Partial<{ EXPIRED_SESSION: boolean, EXPIRING_SESSION: boolean }> } & (({ id: non empty string } & Partial<{ ttl: (integer >= 0 | -1) }>) & { _etag: string, _rid: string, _self: string, _ts: number }))',
            types: [
              {
                name:
                  '{ id: string that matches the pattern "^[A-Z]{6}[0-9LMNPQRSTUV]{2}[ABCDEHLMPRST][0-9LMNPQRSTUV]{2}[A-Z][0-9LMNPQRSTUV]{3}[A-Z]$", expiredAt: number, notificationEvents: Partial<{ EXPIRED_SESSION: boolean, EXPIRING_SESSION: boolean }> }',
                props: {
                  id: {
                    name:
                      'string that matches the pattern "^[A-Z]{6}[0-9LMNPQRSTUV]{2}[ABCDEHLMPRST][0-9LMNPQRSTUV]{2}[A-Z][0-9LMNPQRSTUV]{3}[A-Z]$"',
                    type: { name: "string", _tag: "StringType" },
                    _tag: "RefinementType"
                  },
                  expiredAt: { name: "number", _tag: "NumberType" },
                  notificationEvents: {
                    name:
                      "Partial<{ EXPIRED_SESSION: boolean, EXPIRING_SESSION: boolean }>",
                    props: {
                      EXPIRED_SESSION: {
                        name: "boolean",
                        _tag: "BooleanType"
                      },
                      EXPIRING_SESSION: {
                        name: "boolean",
                        _tag: "BooleanType"
                      }
                    },
                    _tag: "PartialType"
                  }
                },
                _tag: "InterfaceType"
              },
              {
                name:
                  "(({ id: non empty string } & Partial<{ ttl: (integer >= 0 | -1) }>) & { _etag: string, _rid: string, _self: string, _ts: number })",
                types: [
                  {
                    name:
                      "({ id: non empty string } & Partial<{ ttl: (integer >= 0 | -1) }>)",
                    types: [
                      {
                        name: "{ id: non empty string }",
                        props: {
                          id: {
                            name: "non empty string",
                            type: { name: "string", _tag: "StringType" },
                            _tag: "RefinementType"
                          }
                        },
                        _tag: "InterfaceType"
                      },
                      {
                        name: "Partial<{ ttl: (integer >= 0 | -1) }>",
                        props: {
                          ttl: {
                            name: "(integer >= 0 | -1)",
                            types: [
                              {
                                name: "integer >= 0",
                                type: {
                                  name: "Integer",
                                  type: {
                                    name: "number",
                                    _tag: "NumberType"
                                  },
                                  _tag: "RefinementType"
                                },
                                _tag: "RefinementType"
                              },
                              {
                                name: "-1",
                                value: -1,
                                _tag: "LiteralType"
                              }
                            ],
                            _tag: "UnionType"
                          }
                        },
                        _tag: "PartialType"
                      }
                    ],
                    _tag: "IntersectionType"
                  },
                  {
                    name:
                      "{ _etag: string, _rid: string, _self: string, _ts: number }",
                    props: {
                      _etag: { name: "string", _tag: "StringType" },
                      _rid: { name: "string", _tag: "StringType" },
                      _self: { name: "string", _tag: "StringType" },
                      _ts: { name: "number", _tag: "NumberType" }
                    },
                    _tag: "InterfaceType"
                  }
                ],
                _tag: "IntersectionType"
              }
            ],
            _tag: "IntersectionType"
          },
          _tag: "RefinementType"
        },
        actual: {
          id: "AAAAAA89S20I111Y_",
          expiredAt: 1746992855578,
          notificationEvents: { EXPIRED_SESSION: false },
          _rid: "rid==",
          _self: "self=/docs/rid==/",
          _etag: '"etag"',
          _attachments: "attachments/",
          _ts: 1748267875
        }
      },
      {
        key: "0",
        type: {
          name:
            '{ id: string that matches the pattern "^[A-Z]{6}[0-9LMNPQRSTUV]{2}[ABCDEHLMPRST][0-9LMNPQRSTUV]{2}[A-Z][0-9LMNPQRSTUV]{3}[A-Z]$", expiredAt: number, notificationEvents: Partial<{ EXPIRED_SESSION: boolean, EXPIRING_SESSION: boolean }> }',
          props: {
            id: {
              name:
                'string that matches the pattern "^[A-Z]{6}[0-9LMNPQRSTUV]{2}[ABCDEHLMPRST][0-9LMNPQRSTUV]{2}[A-Z][0-9LMNPQRSTUV]{3}[A-Z]$"',
              type: { name: "string", _tag: "StringType" },
              _tag: "RefinementType"
            },
            expiredAt: { name: "number", _tag: "NumberType" },
            notificationEvents: {
              name:
                "Partial<{ EXPIRED_SESSION: boolean, EXPIRING_SESSION: boolean }>",
              props: {
                EXPIRED_SESSION: { name: "boolean", _tag: "BooleanType" },
                EXPIRING_SESSION: { name: "boolean", _tag: "BooleanType" }
              },
              _tag: "PartialType"
            }
          },
          _tag: "InterfaceType"
        },
        actual: {
          id: "AAAAAA89S20I111Y_",
          expiredAt: 1746992855578,
          notificationEvents: { EXPIRED_SESSION: false },
          _rid: "rid==",
          _self: "self=/docs/rid==/",
          _etag: '"etag"',
          _attachments: "attachments/",
          _ts: 1748267875
        }
      },
      {
        key: "id",
        type: {
          name:
            'string that matches the pattern "^[A-Z]{6}[0-9LMNPQRSTUV]{2}[ABCDEHLMPRST][0-9LMNPQRSTUV]{2}[A-Z][0-9LMNPQRSTUV]{3}[A-Z]$"',
          type: { name: "string", _tag: "StringType" },
          _tag: "RefinementType"
        },
        actual: "AAAAAA89S20I111Y_"
      }
    ]
  }
];
