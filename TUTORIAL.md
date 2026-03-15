# Hello World TON

*In this tutorial, you'll build and deploy a smart contract on TON that stores and updates a message on-chain. By the end, you'll have a working contract on testnet with scripts to read and update the stored message.*

## Prerequisites

- Basic programming knowledge.
- [VS Code](https://code.visualstudio.com/) or another IDE.
- [Node v22](https://nodejs.org/en) or higher.
- [Initialized TON wallet](https://docs.ton.org/ecosystem/wallet-apps/tonkeeper#deploy-the-code) with 1–2 TON coins on the [testnet network](https://docs.ton.org/ecosystem/wallet-apps/get-coins).

## Overview

A TON smart contract is a program stored on the TON blockchain and executed by the [TON Virtual Machine](https://docs.ton.org/tvm/overview#tvm-overview) (TVM). Each contract is identified by a unique address and consists of two main components:

- Code — compiled TVM instructions that define the contract's logic.
- Data - persistent state that stores information between interactions.

There are multiple ways to create smart contracts on TON. The recommended approach is to use the Tolk language and the [Blueprint CLI](https://docs.ton.org/contract-dev/blueprint/cli).

If you're coming from the EVM development ecosystem, consider reading about [key TON aspects](https://docs.ton.org/from-ethereum) and [basic Tolk syntax](https://docs.ton.org/languages/tolk/basic-syntax) before proceeding with this tutorial.

## What You'll Build

By the end of this tutorial, your project will have the following structure:

```
HelloWorldProject/
├── contracts/
│   └── hello_world_contract.tolk   # The smart contract logic (Tolk)
├── wrappers/
│   └── HelloWorldContract.ts       # TypeScript class for encoding/decoding contract messages
├── scripts/
│   ├── deployHelloWorldContract.ts # Deploys the contract to testnet
│   ├── getMessage.ts               # Reads the stored message off-chain
│   └── updateMessage.ts            # Sends a transaction to update the message
└── .env                            # Wallet credentials and deployed contract address
```

## Implementation

### Setup

Create your first TON project as follows:

1. Open your terminal and run:

```bash
npm create ton@latest
```

You'll see the following prompt:

```bash
? Project name HelloWorldProject
? First created contract name (PascalCase) HelloWorldContract
? Choose the project template 
❯ An empty contract (Tolk) 
  An empty contract (FunC) 
  An empty contract (Tact) 
  A simple counter contract (Tolk) 
  A simple counter contract (FunC) 
  A simple counter contract (Tact)
```

2. Enter your project and contract name, then select `An empty contract (Tolk)`.

   > **Why Tolk?** Tolk is the recommended language for new TON contracts. Its syntax is the closest to TypeScript and Rust among TON's language options, making it the most approachable starting point.

   Blueprint will create a folder with your project and install the required dependencies.

3. Enter the project directory:

```bash
cd HelloWorldProject
```

### Configure Your Environment

Before writing any code, set up your `.env` file in the root folder with the following variables:

```bash
# .env
WALLET_MNEMONIC="word1 word2 word3 ... word24"    # Your 24-word seed phrase
WALLET_VERSION="v5r1"                             # Find this in your wallet app or on Tonscan
CONTRACT_ADDRESS=""                               # Fill in after deployment
```

You can find your wallet version in your wallet app's settings or by looking up your address on [Tonscan](https://testnet.tonscan.org).

### Write Your First Contract

This contract stores a single message on-chain. It exposes a `message()` getter to read it, and accepts an `UpdateMessage` transaction to overwrite it.

To create the contract, copy the following code and paste it into the `./contracts/hello_world_contract.tolk` file:

```tolk
tolk 1.2

struct Storage {
    message: cell;
}

// read the storage struct from persistent storage
fun Storage.load() {
    return Storage.fromCell(contract.getData());
}

// write the storage struct back to persistent storage
fun Storage.save(self) {
    contract.setData(self.toCell());
}

struct(0x00000001) UpdateMessage {
    message: cell;
}

type AllowedMessage = UpdateMessage;

// return the current message off-chain
get fun message(): slice {
    val storage = lazy Storage.load();
    return storage.message.beginParse();
}

// read the op code and route to the right contract action
fun onInternalMessage(in: InMessage) {
    val msg = lazy AllowedMessage.fromSlice(in.body);
    match (msg) {
        UpdateMessage => {
            var storage = lazy Storage.load();
            storage.message = msg.message;
            storage.save();
        }
        else => {
            assert(in.body.isEmpty()) throw 0xFFFF;
        }
    }
}
```

### Compile the Contract

Compile your contract into bytecode for execution by the TVM:

```bash
npx blueprint build HelloWorldContract
```

Expected output:

```
Build script running, compiling HelloWorldContract
🔧 Using tolk version 1.2.0...


✅ Compiled successfully! Cell BOC result:

{
  "hash": "32d0a2d506fcbffdae7975ecabf00439c6b9da106b6d79e5b70f981e3a591de3",
  "hashBase64": "MtCi1Qb8v/2ueXXsq/AEOca52hBrbXnltw+YHjpZHeM=",
  "hex": "b5ee9c7241010401003e000114ff00f4a413f4bcf2c80b010201620203003ed0f891f24020d72c200000000c9831d74cc8ccc9ed54e030840f01c700f2f40011a0da23da89a1ae99a1172af91d"
}

✅ Wrote compilation artifact to build/HelloWorldContract.compiled.json
```

### Deploy the Contract

Deploying a contract on TON requires two components in addition to the contract itself:

- A wrapper — a TypeScript class you write manually that encodes and decodes messages in the exact binary format your contract expects. Unlike EVM, TON contracts don't have a standard ABI format, so this is how your scripts know how to talk to your contract.
- A deployment script — a Blueprint script that instantiates the wrapper and sends the initial deploy transaction.

#### 1. Create the Wrapper

Replace the contents of the `./wrappers/HelloWorldContract.ts` file with the following code:

```typescript
import { Address, beginCell, Cell, Contract, ContractABI, contractAddress, ContractProvider, Sender, SendMode, toNano } from '@ton/core';

// data required to deploy the contract
export type HelloWorldContractConfig = {
    message: string;
};

// serializes the initial message into a cell for deployment
export function helloWorldContractConfigToCell(config: HelloWorldContractConfig): Cell {
    const messageCell = beginCell().storeStringTail(config.message).endCell();
    return beginCell().storeRef(messageCell).endCell();
}

export class HelloWorldContract implements Contract {
    abi: ContractABI = { name: 'HelloWorldContract' }

    constructor(readonly address: Address, readonly init?: { code: Cell; data: Cell }) {}

    // creates a wrapper instance from an already-deployed contract address
    static createFromAddress(address: Address) {
        return new HelloWorldContract(address);
    }

    // derives the contract address from the compiled code and initial config, returns a deployable instance
    static createFromConfig(config: HelloWorldContractConfig, code: Cell, workchain = 0) {
        const data = helloWorldContractConfigToCell(config);
        const init = { code, data };
        return new HelloWorldContract(contractAddress(workchain, init), init);
    }

    // sends an empty-body transaction to trigger deployment with attached TON to cover fees
    async sendDeploy(provider: ContractProvider, via: Sender, value: bigint) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell().endCell(),
        });
    }

    // encodes op code 0x1 followed by the new message as a ref cell and sends it as a transaction
    async sendUpdateMessage(provider: ContractProvider, via: Sender, newMessage: string) {
        const messageCell = beginCell().storeStringTail(newMessage).endCell();
        await provider.internal(via, {
            value: toNano('0.05'),
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell()
                .storeUint(0x1, 32)
                .storeRef(messageCell)
                .endCell(),
            });
    }

    // calls get fun message() off-chain and returns the current message as a string
    async getMessage(provider: ContractProvider): Promise<string> {
        const result = await provider.get('message', []);
        const slice = result.stack.readCell().beginParse();
        return slice.loadStringTail();
    }
}
```

#### 2. Create the Deployment Script

Open the `./scripts/deployHelloWorldContract.ts` file and replace its contents with the following script:

```typescript
import { toNano } from '@ton/core';
import { HelloWorldContract } from '../wrappers/HelloWorldContract';
import { compile, NetworkProvider } from '@ton/blueprint';

export async function run(provider: NetworkProvider) {
    // compiles the contract, derives the address and binds it to the network provider
    const helloWorldContract = provider.open(
        HelloWorldContract.createFromConfig(
            { message: 'Hello, TON World!' },
            await compile('HelloWorldContract')
        )
    );

    // sends an empty-body transaction with 0.05 TON to trigger deployment
    await helloWorldContract.sendDeploy(provider.sender(), toNano('0.05'));

    // polls the network until the contract address becomes active
    await provider.waitForDeploy(helloWorldContract.address);

    // reads back the stored message to verify the initial state was written correctly
    const result = await provider.provider(helloWorldContract.address).get('message', []);
    const slice = result.stack.readCell().beginParse();
    const message = slice.loadStringTail();
    console.log('Deployed successfully. Stored message:', message);
}
```

#### 3. Run the Deploy Command

With your contract, wrapper, and deployment script in place, deploy to testnet:
```bash
npx blueprint run deployHelloWorldContract --testnet --mnemonic
```

> If you prefer an interactive prompt to choose the script, network, and wallet method, run `npx blueprint run` instead.

> You can find all available flags in the [Blueprint deployment guide](https://docs.ton.org/contract-dev/blueprint/deploy).

Blueprint will read `WALLET_MNEMONIC` and `WALLET_VERSION` from your `.env` file to sign the transaction.

Expected output:
```bash
Using file: deployHelloWorldContract
Connected to wallet at address: 0QDklMt_wtJATm1lc5e2ro0vFalpcodx_0NCKcIovjFsnQVX
Sent transaction
Contract deployed at address kQD2P_X3OglmVY0lTog5w6d6D6gLe74p0SNmfqUXlvNzd8Cm
You can view it at https://testnet.tonscan.org/address/kQD2P_X3OglmVY0lTog5w6d6D6gLe74p0SNmfqUXlvNzd8Cm
Deployed successfully. Stored message: Hello, TON World!
```

Copy the deployed contract address from the output and add it to your `.env` file:
```bash
CONTRACT_ADDRESS=<your_contract_address>
```

### Interact with the Contract

With your contract deployed, you can now read from and write to it using standalone scripts.

#### Retrieve the Message

Create the `./scripts/getMessage.ts` file and paste the following code:

```typescript
import { Address } from '@ton/core';
import { HelloWorldContract } from '../wrappers/HelloWorldContract';
import { NetworkProvider } from '@ton/blueprint';
import * as dotenv from 'dotenv';

dotenv.config();

export async function run(provider: NetworkProvider) {
    const address = Address.parse(process.env.CONTRACT_ADDRESS!);
    const helloWorldContract = provider.open(HelloWorldContract.createFromAddress(address));

    // calls get fun message() off-chain and returns the current message
    const result = await provider.provider(helloWorldContract.address).get('message', []);
    const slice = result.stack.readCell().beginParse();
    const message = slice.loadStringTail();

    console.log('Stored message:', message);
}
```

To retrieve the message, run:

```bash
npx blueprint run getMessage --testnet
```

Expected output:

```bash
Using file: getMessage
? Which wallet are you using? Mnemonic
Connected to wallet at address: 0QCxbE7uklPfYi3LTbEvh97XTfBsUwRf5doGEV4rNHXCXAgg
Stored message: Hello, TON World!
```

#### Update the Message

Create the `./scripts/updateMessage.ts` file and paste the following code:

```typescript
import { Address, toNano } from '@ton/core';
import { HelloWorldContract } from '../wrappers/HelloWorldContract';
import { NetworkProvider } from '@ton/blueprint';
import * as dotenv from 'dotenv';

dotenv.config();

export async function run(provider: NetworkProvider) {
    const address = Address.parse(process.env.CONTRACT_ADDRESS!);

    // prompts for the new message in the CLI
    const newMessage = await provider.ui().input('Enter new message:');

    const helloWorldContract = provider.open(HelloWorldContract.createFromAddress(address));

    // sends a transaction with the new message to the contract
    await helloWorldContract.sendUpdateMessage(provider.sender(), newMessage);

    console.log('Message updated to:', newMessage);
    console.log('View transaction at:', `https://testnet.tonviewer.com/${address.toString()}`);
}
```

To update the message, run:

```bash
npx blueprint run updateMessage --testnet
```

Expected output:

```bash
Using file: updateMessage
? Which wallet are you using? Mnemonic
Connected to wallet at address: 0QDklMt_wtJATm1lc5e2ro0vFalpcodx_0NCKcIovjFsnQVX
? Enter new message: hello 1111
Sent transaction
Message updated to: hello 1111
View transaction at: https://testnet.tonviewer.com/EQD2P_X3OglmVY0lTog5w6d6D6gLe74p0SNmfqUXlvNzd3ss
```

## Troubleshooting

If you run into issues or have suggestions, you can open an issue in the [official TON documentation repository](https://github.com/ton-org/docs/issues/new?title=Issue%20on%20docs).

## Next Steps

- [Testing contracts](https://docs.ton.org/contract-dev/testing/overview)
- [Debugging contracts](https://docs.ton.org/contract-dev/debug)
- [Blueprint CLI](https://docs.ton.org/contract-dev/blueprint/cli)