/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/round.json`.
 */
export type Round = {
  "address": "5kS2nb5CSCVcdb4N7iA1kQuAZYKFttXagoHv2TxWmzg9";
  "metadata": {
    "name": "round";
    "version": "0.1.1";
    "spec": "0.1.0";
  };
  "instructions": [
    {
      "name": "activateRound";
      "discriminator": [
        179,
        179,
        17,
        42,
        181,
        68,
        23,
        123,
      ];
      "accounts": [
        {
          "name": "round";
          "writable": true;
          "pda": {
            "seeds": [
              {
                "kind": "const";
                "value": [
                  114,
                  111,
                  117,
                  110,
                  100,
                ];
              },
              {
                "kind": "account";
                "path": "round.authority";
                "account": "round";
              },
            ];
          };
        },
        {
          "name": "user";
          "signer": true;
        },
      ];
      "args": [];
    },
    {
      "name": "completeRound";
      "discriminator": [
        181,
        146,
        184,
        71,
        6,
        100,
        85,
        214,
      ];
      "accounts": [
        {
          "name": "round";
          "writable": true;
          "pda": {
            "seeds": [
              {
                "kind": "const";
                "value": [
                  114,
                  111,
                  117,
                  110,
                  100,
                ];
              },
              {
                "kind": "account";
                "path": "round.authority";
                "account": "round";
              },
            ];
          };
        },
        {
          "name": "authority";
          "signer": true;
          "relations": [
            "round",
          ];
        },
      ];
      "args": [];
    },
    {
      "name": "initialiseRound";
      "discriminator": [
        218,
        162,
        72,
        121,
        145,
        162,
        217,
        167,
      ];
      "accounts": [
        {
          "name": "round";
          "writable": true;
          "pda": {
            "seeds": [
              {
                "kind": "const";
                "value": [
                  114,
                  111,
                  117,
                  110,
                  100,
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
          "name": "authority";
          "writable": true;
          "signer": true;
        },
        {
          "name": "systemProgram";
          "address": "11111111111111111111111111111111";
        },
      ];
      "args": [
        {
          "name": "startSlot";
          "type": "u64";
        },
      ];
    },
  ];
  "accounts": [
    {
      "name": "round";
      "discriminator": [
        87,
        127,
        165,
        51,
        73,
        78,
        116,
        174,
      ];
    },
  ];
  "errors": [
    {
      "code": 6000;
      "name": "invalidStartSlot";
      "msg": "The start slot must be greater than the current slot";
    },
    {
      "code": 6001;
      "name": "roundAlreadyActive";
      "msg": "The round is already active";
    },
    {
      "code": 6002;
      "name": "roundNotYetActive";
      "msg": "The round has not yet been activated";
    },
    {
      "code": 6003;
      "name": "roundAlreadyComplete";
      "msg": "The round is already complete";
    },
    {
      "code": 6004;
      "name": "invalidRoundActivationSlot";
      "msg": "The current slot must be greater than or equal to the start slot";
    },
  ];
  "types": [
    {
      "name": "round";
      "type": {
        "kind": "struct";
        "fields": [
          {
            "name": "startSlot";
            "type": "u64";
          },
          {
            "name": "authority";
            "type": "pubkey";
          },
          {
            "name": "activatedAt";
            "type": {
              "option": "u64";
            };
          },
          {
            "name": "activatedBy";
            "type": {
              "option": "pubkey";
            };
          },
          {
            "name": "completedAt";
            "type": {
              "option": "u64";
            };
          },
        ];
      };
    },
  ];
};
