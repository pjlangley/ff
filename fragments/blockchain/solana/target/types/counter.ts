/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/counter.json`.
 */
export type Counter = {
  "address": "HdxpgGmRXeUpXE2vVZZCy2a69Ypozs8YLt3LXPHRUkG6";
  "metadata": {
    "name": "counter";
    "version": "0.2.1";
    "spec": "0.1.0";
  };
  "instructions": [
    {
      "name": "increment";
      "discriminator": [
        11,
        18,
        104,
        9,
        104,
        174,
        59,
        33,
      ];
      "accounts": [
        {
          "name": "counter";
          "writable": true;
        },
        {
          "name": "user";
          "writable": true;
          "signer": true;
        },
      ];
      "args": [];
    },
    {
      "name": "initialize";
      "discriminator": [
        175,
        175,
        109,
        31,
        13,
        152,
        155,
        237,
      ];
      "accounts": [
        {
          "name": "user";
          "writable": true;
          "signer": true;
        },
        {
          "name": "counter";
          "writable": true;
          "pda": {
            "seeds": [
              {
                "kind": "const";
                "value": [
                  99,
                  111,
                  117,
                  110,
                  116,
                  101,
                  114,
                ];
              },
              {
                "kind": "account";
                "path": "user";
              },
            ];
          };
        },
        {
          "name": "systemProgram";
          "address": "11111111111111111111111111111111";
        },
      ];
      "args": [];
    },
  ];
  "accounts": [
    {
      "name": "counter";
      "discriminator": [
        255,
        176,
        4,
        245,
        188,
        253,
        124,
        25,
      ];
    },
  ];
  "types": [
    {
      "name": "counter";
      "type": {
        "kind": "struct";
        "fields": [
          {
            "name": "count";
            "type": "u64";
          },
        ];
      };
    },
  ];
};
