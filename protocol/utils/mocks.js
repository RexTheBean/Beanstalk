const { BEANSTALK } = require("../test/utils/constants");
const { mintEth, impersonateBeanstalkOwner, getBeanstalk } = require("../utils");
const { upgradeWithNewFacets } = require("../scripts/diamond");
const { bip29, bip30 } = require("../scripts/bips");
const { deployRoot } = require("../scripts/root");
const { deployDepot, impersonateDepot } = require("../scripts/depot");

async function mockAdmin() {
    console.log('Adding Mocks')
    const signer = await impersonateBeanstalkOwner()
    await mintEth(signer.address)
    await upgradeWithNewFacets({
        diamondAddress: BEANSTALK,
        facetNames: ['MockAdminFacet'],
        bip: false,
        verbose: false,
        account: signer
    });
}

async function mockSunrise() {
    beanstalk = await getBeanstalk()
    const lastTimestamp = (await ethers.provider.getBlock('latest')).timestamp;
    const hourTiemstamp = parseInt(lastTimestamp/3600 + 1) * 3600
    await network.provider.send("evm_setNextBlockTimestamp", [hourTiemstamp])
    await beanstalk.sunrise()

}

async function deployV2_1() {
    await bip29()
    await bip30()
    await mockAdmin()
    await deployRoot()
    await impersonateDepot()
}

exports.mockAdmin = mockAdmin
exports.deployV2_1 = deployV2_1
exports.mockSunrise = mockSunrise