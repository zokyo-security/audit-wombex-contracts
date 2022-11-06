"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fromFancyAddress = exports.toFancyAddress = exports.getHardhatBaseProvider = void 0;
const address_1 = require("@nomicfoundation/ethereumjs-util/dist/address");
const _1 = require(".");
const getHardhatBaseProvider = async (runtime) => {
    const maxLoopIterations = 1024;
    let currentLoopIterations = 0;
    let provider = runtime.network.provider;
    while (provider._wrapped !== undefined) {
        provider = provider._wrapped;
        currentLoopIterations += 1;
        if (currentLoopIterations > maxLoopIterations) {
            throw new Error(`[smock]: unable to find base hardhat provider. are you sure you're running locally?`);
        }
    }
    if (provider._node === undefined) {
        await provider._init();
    }
    return provider;
};
exports.getHardhatBaseProvider = getHardhatBaseProvider;
const toFancyAddress = (address) => {
    return address_1.Address.fromString(address);
};
exports.toFancyAddress = toFancyAddress;
const fromFancyAddress = (fancyAddress) => {
    if (fancyAddress.buf) {
        return (0, _1.toHexString)(fancyAddress.buf);
    }
    else {
        return fancyAddress.toString();
    }
};
exports.fromFancyAddress = fromFancyAddress;
//# sourceMappingURL=hardhat.js.map