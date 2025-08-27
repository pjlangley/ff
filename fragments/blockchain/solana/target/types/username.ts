/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/username.json`.
 */
export type Username = {
  "address": "uMeQ3a2zVJf1pVa4uFu2Y6i88S3soEq3Q2aJjod3VD8";
  "metadata": {
    "name": "username";
    "version": "0.1.1";
    "spec": "0.1.0";
  };
  "instructions": [
    {
      "name": "initializeUsername";
      "discriminator": [
        87,
        43,
        231,
        154,
        78,
        232,
        34,
        161,
      ];
      "accounts": [
        {
          "name": "authority";
          "writable": true;
          "signer": true;
        },
        {
          "name": "userAccount";
          "writable": true;
          "pda": {
            "seeds": [
              {
                "kind": "const";
                "value": [
                  117,
                  115,
                  101,
                  114,
                  95,
                  97,
                  99,
                  99,
                  111,
                  117,
                  110,
                  116,
                ];
              },
              {
                "kind": "account";
                "path": "authority";
              },
            ];
          };
        },
        {
          "name": "systemProgram";
          "address": "11111111111111111111111111111111";
        },
      ];
      "args": [
        {
          "name": "username";
          "type": {
            "defined": {
              "name": "username";
            };
          };
        },
      ];
    },
    {
      "name": "updateUsername";
      "discriminator": [
        233,
        103,
        45,
        8,
        250,
        100,
        216,
        251,
      ];
      "accounts": [
        {
          "name": "authority";
          "writable": true;
          "signer": true;
          "relations": [
            "userAccount",
          ];
        },
        {
          "name": "userAccount";
          "writable": true;
        },
        {
          "name": "usernameRecord";
          "writable": true;
          "pda": {
            "seeds": [
              {
                "kind": "const";
                "value": [
                  117,
                  115,
                  101,
                  114,
                  110,
                  97,
                  109,
                  101,
                  95,
                  114,
                  101,
                  99,
                  111,
                  114,
                  100,
                ];
              },
              {
                "kind": "account";
                "path": "authority";
              },
              {
                "kind": "account";
                "path": "user_account.change_count";
                "account": "userAccount";
              },
            ];
          };
        },
        {
          "name": "systemProgram";
          "address": "11111111111111111111111111111111";
        },
      ];
      "args": [
        {
          "name": "username";
          "type": {
            "defined": {
              "name": "username";
            };
          };
        },
      ];
    },
  ];
  "accounts": [
    {
      "name": "userAccount";
      "discriminator": [
        211,
        33,
        136,
        16,
        186,
        110,
        242,
        127,
      ];
    },
    {
      "name": "usernameRecord";
      "discriminator": [
        42,
        172,
        136,
        41,
        240,
        123,
        100,
        204,
      ];
    },
  ];
  "errors": [
    {
      "code": 6000;
      "name": "usernameTooLong";
      "msg": "Username is too long (maximum length is 32 characters)";
    },
    {
      "code": 6001;
      "name": "usernameTooShort";
      "msg": "Username is too short (minimum length is 2 characters)";
    },
    {
      "code": 6002;
      "name": "usernameInvalidCharacters";
      "msg": "Username contains invalid characters (only ascii alphanumeric, underscores, and hyphens are allowed)";
    },
    {
      "code": 6003;
      "name": "usernameAlreadyAssigned";
      "msg": "Username is already assigned";
    },
  ];
  "types": [
    {
      "name": "userAccount";
      "type": {
        "kind": "struct";
        "fields": [
          {
            "name": "authority";
            "type": "pubkey";
          },
          {
            "name": "username";
            "type": {
              "defined": {
                "name": "username";
              };
            };
          },
          {
            "name": "changeCount";
            "type": "u64";
          },
          {
            "name": "usernameRecentHistory";
            "type": {
              "vec": {
                "defined": {
                  "name": "username";
                };
              };
            };
          },
        ];
      };
    },
    {
      "name": "username";
      "type": {
        "kind": "struct";
        "fields": [
          {
            "name": "value";
            "type": "string";
          },
        ];
      };
    },
    {
      "name": "usernameRecord";
      "type": {
        "kind": "struct";
        "fields": [
          {
            "name": "authority";
            "type": "pubkey";
          },
          {
            "name": "oldUsername";
            "type": {
              "defined": {
                "name": "username";
              };
            };
          },
          {
            "name": "changeIndex";
            "type": "u64";
          },
        ];
      };
    },
  ];
};
