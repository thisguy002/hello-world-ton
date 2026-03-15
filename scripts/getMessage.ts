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