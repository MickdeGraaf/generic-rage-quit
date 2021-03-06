# Generic Rage Quit

This contract allows any DAO to have a Rage Quit mechanism without having to modify any of its existing code.
It is required that the DAO gov tokens are transferable and that the DAO is able to execute approvals from the contract holding its tokens.

Development was kindly supported by [Tally](https://www.withtally.com/) ❤

## Usage

### Pre Requisites

Before running any command, you need to create a `.env` file and set a BIP-39 compatible mnemonic as an environment
variable. Follow the example in `.env.example`. If you don't already have a mnemonic, use this [website](https://iancoleman.io/bip39/) to generate one.

Then, proceed with installing dependencies:

```sh
yarn install
```

### Compile

Compile the smart contracts with Hardhat:

```sh
$ yarn compile
```

### TypeChain

Compile the smart contracts and generate TypeChain artifacts:

```sh
$ yarn typechain
```

### Lint Solidity

Lint the Solidity code:

```sh
$ yarn lint:sol
```

### Lint TypeScript

Lint the TypeScript code:

```sh
$ yarn lint:ts
```

### Test

Run the Mocha tests:

```sh
$ yarn test
```

### Coverage

Generate the code coverage report:

```sh
$ yarn coverage
```

### Report Gas

See the gas usage per unit test and average gas per method call:

```sh
$ REPORT_GAS=true yarn test
```

### Clean

Delete the smart contract artifacts, the coverage reports and the Hardhat cache:

```sh
$ yarn clean
```

### Demo deployment

- Install dependencies and compile. (See above)
- Get some ropsten ETH
- Setup `.env` file by copying and filling in `.env.example`
- Run `yarn deploy:testdao`
- Wait. It takes some time
- The contracts deployed will be logged at the end
- Go to the rageQuit contract at: https://ropsten.etherscan.io/address/`rageQuitContractAddress`#writeContract
- Connect with the same wallet you deployed from through MetaMask
- Call rageQuit with the following params:
  - _quitAmount: 1000000000000000000
  - Order the token addresses manually. If token addresses are submitted out of order the tx will fail.
  - _tokens: Addresses of the MockTokens formatted in this manner: ``["TOKEN_0_ADDRSSS", "TOKEN_1_ADDRSSS", "TOKEN_3_ADDRSSS", "TOKEN_4_ADDRSSS", "TOKEN_5_ADDRSSS"]
- Witness your beautiful rageQuit tx

[Example tx rageQuiting](https://ropsten.etherscan.io/tx/0x463c70727af2b9db7fee9bbf07fc735382c23a5c36e7bd3af24529003f0cf02a)

### Deploy

Deploy the contracts to Hardhat Network:

```sh
$ yarn deploy:rageQuit --rage-quit-token [gov token of the dao] --vault [contract holding the tokens in the treasury]
```

Each token which should be claimable on rage quit needs to be approved from the vault to allow the rage quit contract to pull the tokens.

### Integration

1. Deploy contract (see above)
2. Approve rage quitable tokens through a DAO vote to allow the rageQuit contract to spend them.
3. To ragequit call ``rageQuit(uint256 _quitAmount, address[] calldata _tokens)`` passing the amount of tokens you want to burn and which tokens you want to claim.

## Syntax Highlighting

If you use VSCode, you can enjoy syntax highlighting for your Solidity code via the
[vscode-solidity](https://github.com/juanfranblanco/vscode-solidity) extension. The recommended approach to set the
compiler version is to add the following fields to your VSCode user settings:

```json
{
  "solidity.compileUsingRemoteVersion": "v0.8.4+commit.c7e474f2",
  "solidity.defaultCompiler": "remote"
}
```

Where of course `v0.8.4+commit.c7e474f2` can be replaced with any other version.
