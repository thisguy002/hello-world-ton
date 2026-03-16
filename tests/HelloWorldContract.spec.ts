import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { Cell, toNano } from '@ton/core';
import { HelloWorldContract } from '../wrappers/HelloWorldContract';
import '@ton/test-utils';
import { compile } from '@ton/blueprint';

describe('HelloWorldContract', () => {
    let code: Cell;

    beforeAll(async () => {
        code = await compile('HelloWorldContract');
    });

    let blockchain: Blockchain;
    let deployer: SandboxContract<TreasuryContract>;
    let helloWorldContract: SandboxContract<HelloWorldContract>;

    beforeEach(async () => {
        blockchain = await Blockchain.create();

        helloWorldContract = blockchain.openContract(
            HelloWorldContract.createFromConfig({ message: 'Hello, TON World!' }, code)
        );

        deployer = await blockchain.treasury('deployer');

        const deployResult = await helloWorldContract.sendDeploy(deployer.getSender(), toNano('0.05'));

        expect(deployResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: helloWorldContract.address,
            deploy: true,
            success: true,
        });
    });

    it('should deploy', async () => {
        // the check is done inside beforeEach
    });

    it('should return the initial message', async () => {
        const message = await helloWorldContract.getMessage();
        expect(message).toBe('Hello, TON World!');
    });

    it('should update the message', async () => {
        await helloWorldContract.sendUpdateMessage(deployer.getSender(), 'New message');
        const message = await helloWorldContract.getMessage();
        expect(message).toBe('New message');
    });

    it('should accept plain TON transfer with no instruction', async () => {
        const result = await deployer.send({
            to: helloWorldContract.address,
            value: toNano('0.01'),
        });
        expect(result.transactions).toHaveTransaction({
            to: helloWorldContract.address,
            success: true,
        });
    });
});