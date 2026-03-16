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