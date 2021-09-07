import { task } from "hardhat/config";
import { TaskArguments } from "hardhat/types";
import { 
    DAO__factory,
    IERC20,
    IERC20__factory,
    RageQuit__factory,
    TimelockController__factory,
    GovToken__factory,
    GovToken,
    TimelockController, 
    DAO,
    RageQuit,
    MockToken,
    MockToken__factory
} from "../../typechain";
import { constants } from "ethers/lib/ethers";
import { parseEther } from "ethers/lib/utils";
import sleep from "../../utils/sleep";

interface DAODeployment {
    token: GovToken;
    timelock: TimelockController;
    DAO: DAO,
    rageQuit: RageQuit
}

const VERIFY_DELAY = 100000;
const ZERO_BYTES32 = "0x0000000000000000000000000000000000000000000000000000000000000000";

task("deploy-ragequit-dao")
    .addParam("tokenName", "name of the erc20 gov token")
    .addParam("tokenSymbol", "symbol of the erc20 gov token")
    .addParam("initialSupply", "initialSupply of the erc20 gov token")
    .addParam("whitelistedTokens", "tokens whitelisted for ragequit. Comma seperated")
    .addParam("daoName", "name of the DAO")
    .addParam("minDelay", "delay in blocks between creation of a proposal and voting start")
    .addParam("votingDelay", "delay in blocks between proposal and voting start")
    .addParam("votingPeriod", "seconds a proposal is open for voting")
    .addFlag("verify")
    .setAction(async(taskArgs: TaskArguments, { ethers, run }): Promise<DAODeployment> => {
        const signers = await ethers.getSigners()
        // deploy token
        console.log("deploying gov token");
        const token = await new GovToken__factory(signers[0]).deploy(taskArgs.tokenName, taskArgs.tokenSymbol, parseEther(taskArgs.initialSupply));
        if(taskArgs.verify) {
            await token.deployed();
            await sleep(VERIFY_DELAY);
            await run("verify:verify", {
                address: token.address,
                constructorArguments: [
                    taskArgs.tokenName,
                    taskArgs.tokenSymbol,
                    parseEther(taskArgs.initialSupply)
                ]
            })
        }
        console.log(`gov token deployed at: ${token.address}`);

        // deploy timelock'
        console.log("deploying timelock")
        console.log(`minDelay: ${taskArgs.minDelay}`);
        const timelock = await new TimelockController__factory(signers[0]).deploy(0, [signers[0].address], [signers[0].address]);
        console.log(`deployed timelock at: ${timelock.address}`)
        if(taskArgs.verify) {
            await timelock.deployed();
            await sleep(VERIFY_DELAY);
            await run("verify:verify", {
                address: timelock.address,
                constructorArguments: [
                    0,
                    [signers[0].address],
                    [signers[0].address]
                ]
            });
        }

        // deploy DAO
        console.log("deploying DAO");
        const DAO = await new DAO__factory(signers[0]).deploy(
            token.address,
            timelock.address,
            taskArgs.daoName,
            taskArgs.votingDelay,
            taskArgs.votingPeriod
        );
        console.log(`DAO deployed at: ${DAO.address}`)
        if(taskArgs.verify) {
            await DAO.deployed();
            await sleep(VERIFY_DELAY);
            await run("verify:verify", {
                address: DAO.address,
                constructorArguments: [
                    token.address,
                    timelock.address,
                    taskArgs.daoName,
                    taskArgs.votingDelay,
                    taskArgs.votingPeriod
                ]
            });
        }

        // deploy rageQuit
        console.log("deploying rageQuit");
        const rageQuit = await new RageQuit__factory(signers[0]).deploy(token.address, timelock.address);
        console.log(`deployed rageQuit at: ${rageQuit.address}`)
        if(taskArgs.verify) {
            await rageQuit.deployed();
            await sleep(VERIFY_DELAY);
            await run("verify:verify", {
                address: rageQuit.address,
                constructorArguments: [
                    token.address,
                    timelock.address
                ]
            });
        }

        // whitelist tokens
        const targets = String(taskArgs.whitelistedTokens).split(",");
        const values = targets.map(() => 0);
        const tempToken = IERC20__factory.connect(targets[0], signers[0]);
        const approveMaxData = await tempToken.populateTransaction.approve(rageQuit.address, constants.MaxUint256);
        const datas = targets.map(() => approveMaxData.data as string);
        
        console.log("submitting token approvals txs");
        await timelock.scheduleBatch(targets, values, datas, ZERO_BYTES32, ZERO_BYTES32, 0, {gasLimit: 5000000});
        await timelock.executeBatch(targets, values, datas, ZERO_BYTES32, ZERO_BYTES32, {gasLimit: 5000000});
        console.log("approval tx mined");

        return {
            token,
            timelock,
            DAO,
            rageQuit
        }
});

task("setup-dao-permissions")
    .addParam("daoAddress", "address of the DAO")
    .addParam("minDelay", "timelock delay in seconds")
    .setAction(async(taskArgs: TaskArguments, { ethers, run}) => {
        const signers = await ethers.getSigners();

        const DAO = DAO__factory.connect(taskArgs.daoAddress, signers[0]);
        const timelockAddress = await DAO.timelock();
        const timelock = await TimelockController__factory.connect(timelockAddress, signers[0]);

        const TIME_LOCK_ADMIN_ROLE = await timelock.TIMELOCK_ADMIN_ROLE();
        const PROPOSER_ROLE = await timelock.PROPOSER_ROLE();
        const EXECUTOR_ROLE = await timelock.EXECUTOR_ROLE();

        console.log("Setting up roles");
        // set DAO as proposer
        await timelock.grantRole(PROPOSER_ROLE, DAO.address);
        // allow anyone to execute
        await timelock.grantRole(EXECUTOR_ROLE, constants.AddressZero);

        console.log("setting min delay");
        const delayData = await timelock.populateTransaction.updateDelay(taskArgs.minDelay);
        await timelock.schedule(timelock.address, 0, delayData.data as string, ZERO_BYTES32, ZERO_BYTES32, 0, {gasLimit: 5000000});
        await timelock.execute(timelock.address, 0, delayData.data as string, ZERO_BYTES32, ZERO_BYTES32, {gasLimit: 5000000});
        console.log("min delay")

        console.log("Renouncing roles");
        // renounce roles
        await timelock.renounceRole(TIME_LOCK_ADMIN_ROLE, signers[0].address);
        await timelock.renounceRole(PROPOSER_ROLE, signers[0].address);
        await timelock.renounceRole(EXECUTOR_ROLE, signers[0].address);
});

task("deploy-test-dao")
    .addParam("tokenName", "name of the erc20 gov token")
    .addParam("tokenSymbol", "symbol of the erc20 gov token")
    .addParam("initialSupply", "initialSupply of the erc20 gov token")
    .addParam("daoName", "name of the DAO")
    .addParam("minDelay", "delay in seconds for the timelock")
    .addParam("votingPeriod", "seconds a proposal is open for voting")
    .addParam("votingDelay", "delay in blocks between proposal and voting start")
    .addParam("mockTokenCount", "number of mock tokens to deploy")
    .addFlag("verify")
    .setAction(async(taskArgs: TaskArguments, { ethers, run }) => {
        const signers = await ethers.getSigners();

        const mockTokens: MockToken[] = [];
        const mockTokenAddresses: string[] = [];
        const mockTokenFactory = new MockToken__factory(signers[0]);

        // deploy mock tokens
        for(let i = 0; i < taskArgs.mockTokenCount; i ++) {
            // deploy mock token
            const initialSupply = parseEther(((i + 1 ) * 100000000).toString())
            const mockToken = await mockTokenFactory.deploy(
                `MockToken ${i}`,
                `MCK${i}`,
                initialSupply
            );

            if(taskArgs.verify) {
                console.log(`Waiting for MockToken deploy at address ${mockToken.address}. ${new Date().toLocaleString()}`)
                await mockToken.deployed();
                await sleep(VERIFY_DELAY);
                console.log(`MockToken deployed ${new Date().toLocaleString()}`)
                // console.log(JSON.stringify([
                //     `MockToken ${i}`,
                //     `MCK${i}`,
                //     initialSupply
                // ]));
                await run("verify:verify", {
                    address: mockToken.address,
                    constructorArguments: [
                        `MockToken ${i}`,
                        `MCK${i}`,
                        initialSupply.toString()
                    ]
                });
            }
            mockTokens.push(mockToken);
            mockTokenAddresses.push(mockToken.address);
        }

        // deploy DAO
        const deployment:DAODeployment = await run("deploy-ragequit-dao", { 
            whitelistedTokens: mockTokenAddresses.join(","),
            ...taskArgs
        });

        // send all mock tokens to the DAO
        for (const mockToken of mockTokens) {
            const tokenBalance = await mockToken.balanceOf(signers[0].address);
            await mockToken.transfer(deployment.timelock.address, tokenBalance);
        }

        //approve rageQuit to spend gov tokens
        await deployment.token.approve(deployment.rageQuit.address, constants.MaxUint256);

        // setup permissions
        await run("setup-dao-permissions", {daoAddress: deployment.DAO.address, minDelay: taskArgs.minDelay});

        const deployedContracts: any = {};

        for (const contract in deployment) {
            // @ts-ignore
            deployedContracts[contract] = deployment[contract].address
        }

        mockTokens.map((token, index) => {
            deployedContracts[`MockToken ${index}`] = token.address;
        });

        console.table(deployedContracts);
});