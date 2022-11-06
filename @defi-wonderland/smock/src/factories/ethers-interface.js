"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ethersInterfaceFromSpec = void 0;
const ethers_1 = require("ethers");
const hardhat_1 = __importDefault(require("hardhat"));
async function ethersInterfaceFromSpec(spec) {
    if (typeof spec === 'string') {
        try {
            if (isMaybeJsonObject(spec)) {
                return await ethersInterfaceFromAbi(spec);
            }
            else {
                return await ethersInterfaceFromContractName(spec);
            }
        }
        catch (err) {
            throw err;
        }
    }
    let foundInterface = spec;
    if (foundInterface.abi) {
        foundInterface = foundInterface.abi;
    }
    else if (foundInterface.interface) {
        foundInterface = foundInterface.interface;
    }
    if (foundInterface instanceof ethers_1.ethers.utils.Interface) {
        return foundInterface;
    }
    else {
        return new ethers_1.ethers.utils.Interface(foundInterface);
    }
}
exports.ethersInterfaceFromSpec = ethersInterfaceFromSpec;
async function ethersInterfaceFromAbi(abi) {
    try {
        return new ethers_1.ethers.utils.Interface(abi);
    }
    catch (err) {
        const error = err;
        throw new Error(`unable to generate smock spec from abi string.\n${error.message}`);
    }
}
async function ethersInterfaceFromContractName(contractNameOrFullyQualifiedName) {
    let error = null;
    try {
        return (await hardhat_1.default.ethers.getContractFactory(contractNameOrFullyQualifiedName)).interface;
    }
    catch (err) {
        error = err;
    }
    try {
        return (await hardhat_1.default.ethers.getContractAt(contractNameOrFullyQualifiedName, ethers_1.ethers.constants.AddressZero)).interface;
    }
    catch (err) {
        error = err;
    }
    throw new Error(`unable to generate smock spec from contract name.\n${error.message}`);
}
function isMaybeJsonObject(str) {
    let strJson = str.trim();
    return strJson.charAt(0) == '{' && strJson.charAt(strJson.length - 1) == '}';
}
//# sourceMappingURL=ethers-interface.js.map