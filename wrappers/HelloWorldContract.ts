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