import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { BigNumber, constants, Signer } from "ethers";
import { parseEther } from "ethers/lib/utils";
import hre from "hardhat";
import { RageQuit, RageQuit__factory } from "../../typechain";
import { MockToken__factory } from "../../typechain/factories/MockToken__factory";
import { MockToken } from "../../typechain/MockToken";
import TimeTraveler from "../../utils/TimeTraveler";

describe("RageQuit", function() {
    const INITIAL_RQT_SUPPLY = parseEther("1000000");
    
    let account: SignerWithAddress;
    let vault: SignerWithAddress;
    let rageQuit: RageQuit;
    let rageQuitToken: MockToken;
    let vaultTokens: MockToken[] = [];
    let vaultTokenAddresses: string[] = [];
    const timeTraveler: TimeTraveler = new TimeTraveler(hre.network.provider);

    before(async() => {
        [account, vault] = await hre.ethers.getSigners();

        const mockTokenFactory = await new MockToken__factory(account);
        rageQuitToken = await mockTokenFactory.deploy("RQT", "RageQuit token", INITIAL_RQT_SUPPLY);

        for(let i = 0; i < 10; i ++) {
            vaultTokens.push(
                // mint directly into the vault
                await new MockToken__factory(vault).deploy(`TKN${i}`, `TKN{i}`, INITIAL_RQT_SUPPLY)
            );

            vaultTokenAddresses.push(vaultTokens[i].address);
        }

        // sort token addresses, native js sort did not work very well
        vaultTokenAddresses = vaultTokenAddresses.sort((a, b) => {
            // if the same do nothing
            if(a === b) {
                return 0;
            }

            // if a < b don't change order
            if(BigNumber.from(a).lt(BigNumber.from(b))) {
                return -1;
            }

            // flip order
            return 1;
        });

        rageQuit = await new RageQuit__factory(account).deploy(rageQuitToken.address, vault.address);
        // approve ragequit contract to pull RQT token from account
        await rageQuitToken.approve(rageQuit.address, constants.MaxUint256);

        // approve ragequit contract to pull tokens from vault
        for (const token of vaultTokens) {
            await token.connect(vault).approve(rageQuit.address, constants.MaxUint256);
        }

        await timeTraveler.snapshot();
    });

    beforeEach(async() => {
        await timeTraveler.revertSnapshot();
    });


    it("Rage quiting the full token supply should work", async() => {
        await rageQuit.rageQuit(INITIAL_RQT_SUPPLY, vaultTokenAddresses);

        for(const token of vaultTokens) {
            const vaultTokenBalance = await token.balanceOf(vault.address);
            const accountTokenBalance = await token.balanceOf(account.address);

            expect(vaultTokenBalance).to.eq(0);
            expect(accountTokenBalance).to.eq(INITIAL_RQT_SUPPLY);
        };

        const accountRqtBalance = await rageQuitToken.balanceOf(account.address);
        const vaultRqtBalance = await rageQuitToken.balanceOf(vault.address);

        expect(accountRqtBalance).to.eq(0);
        expect(vaultRqtBalance).to.eq(INITIAL_RQT_SUPPLY);
    });

    it("Partial rage quit should work", async() => {
        await rageQuit.rageQuit(INITIAL_RQT_SUPPLY.div(2), vaultTokenAddresses);

        for(const token of vaultTokens) {
            const vaultTokenBalance = await token.balanceOf(vault.address);
            const accountTokenBalance = await token.balanceOf(account.address);

            expect(vaultTokenBalance).to.eq(INITIAL_RQT_SUPPLY.div(2));
            expect(accountTokenBalance).to.eq(INITIAL_RQT_SUPPLY.div(2));
        };

        const accountRqtBalance = await rageQuitToken.balanceOf(account.address);
        const vaultRqtBalance = await rageQuitToken.balanceOf(vault.address);

        expect(accountRqtBalance).to.eq(INITIAL_RQT_SUPPLY.div(2));
        expect(vaultRqtBalance).to.eq(INITIAL_RQT_SUPPLY.div(2));
    });

    it("Rage quitting ignoring some tokens should work", async() => {
        const rageQuitTokens = vaultTokens.slice(0, -1); //pop off last token
        const ignoredToken = vaultTokens[vaultTokens.length - 1];
        // rage quit leaving the ignored token out
        await rageQuit.rageQuit(INITIAL_RQT_SUPPLY, vaultTokenAddresses.filter((value) => value != ignoredToken.address));

        for(const token of rageQuitTokens) {
            const vaultTokenBalance = await token.balanceOf(vault.address);
            const accountTokenBalance = await token.balanceOf(account.address);

            expect(vaultTokenBalance).to.eq(0);
            expect(accountTokenBalance).to.eq(INITIAL_RQT_SUPPLY);
        };

        const accountRqtBalance = await rageQuitToken.balanceOf(account.address);
        const vaultRqtBalance = await rageQuitToken.balanceOf(vault.address);

        expect(accountRqtBalance).to.eq(0);
        expect(vaultRqtBalance).to.eq(INITIAL_RQT_SUPPLY);

        const accountIgnoredTokenBalance = await ignoredToken.balanceOf(account.address);
        const vaultIgnoredTokenBalance = await ignoredToken.balanceOf(vault.address);

        // check if ignored token did not move
        expect(accountIgnoredTokenBalance).to.eq(0);
        expect(vaultIgnoredTokenBalance).to.eq(INITIAL_RQT_SUPPLY);
    });

    it("Rage quit while there are gov tokens in the vault should work", async() => {
        // rage quit in 2 stages to test if the gov tokens in the vault itself are ignored
        await rageQuit.rageQuit(INITIAL_RQT_SUPPLY.div(2), vaultTokenAddresses);
        await rageQuit.rageQuit(INITIAL_RQT_SUPPLY.div(2), vaultTokenAddresses);

        for(const token of vaultTokens) {
            const vaultTokenBalance = await token.balanceOf(vault.address);
            const accountTokenBalance = await token.balanceOf(account.address);

            expect(vaultTokenBalance).to.eq(0);
            expect(accountTokenBalance).to.eq(INITIAL_RQT_SUPPLY);
        };

        const accountRqtBalance = await rageQuitToken.balanceOf(account.address);
        const vaultRqtBalance = await rageQuitToken.balanceOf(vault.address);

        expect(accountRqtBalance).to.eq(0);
        expect(vaultRqtBalance).to.eq(INITIAL_RQT_SUPPLY);
    });

    it("Trying to rage quit a token twice should fail", async() => {
        await expect(
            rageQuit.rageQuit(INITIAL_RQT_SUPPLY, [...vaultTokenAddresses, vaultTokenAddresses[vaultTokenAddresses.length - 1]])
        ).to.be.revertedWith("RageQuit.rageQuit: Tokens out of order");
    });

    it("Rage quiting more than the address balance should fail", async() => {
        await expect(
            rageQuit.rageQuit(INITIAL_RQT_SUPPLY.add(1), vaultTokenAddresses)
        ).to.be.revertedWith("ERC20: transfer amount exceeds balance");
    });

    it("Rage quitting while the sender did not approve the rage quit token to be spend by the contract should fail", async() => {
        await rageQuitToken.approve(rageQuit.address, 0);
        await expect(
            rageQuit.rageQuit(INITIAL_RQT_SUPPLY, vaultTokenAddresses)
        ).to.be.revertedWith("ERC20: transfer amount exceeds allowance");
    });

    it("Rage quitting while the vault did not approve a token to be spend should fail", async() => {
        await vaultTokens[0].connect(vault).approve(rageQuit.address, 0);

        await expect(
            rageQuit.rageQuit(INITIAL_RQT_SUPPLY, vaultTokenAddresses)
        ).to.be.revertedWith("ERC20: transfer amount exceeds allowance");
    });

    it("Trying to claim rageQuitToken in the vault should fail", async() => {
        await expect(
            rageQuit.rageQuit(INITIAL_RQT_SUPPLY, [...vaultTokenAddresses, rageQuitToken.address]))
        .to.be.revertedWith("RageQuit.rageQuit: Cannot claim rageQuitToken");
    });

});