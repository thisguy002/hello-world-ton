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