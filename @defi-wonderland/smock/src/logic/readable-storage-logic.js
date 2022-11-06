"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReadableStorageLogic = void 0;
const utils_1 = require("../utils");
const storage_1 = require("../utils/storage");
class ReadableStorageLogic {
    constructor(storageLayout, vmManager, contractAddress) {
        this.storageLayout = storageLayout;
        this.vmManager = vmManager;
        this.contractAddress = contractAddress;
    }
    async getVariable(variableName, mappingKeys) {
        const slots = await (0, storage_1.getVariableStorageSlots)(this.storageLayout, variableName, this.vmManager, this.contractAddress, mappingKeys);
        const slotValueTypePairs = await Promise.all(slots.map(async (slotKeyPair) => (Object.assign(Object.assign({}, slotKeyPair), { value: (0, utils_1.remove0x)((0, utils_1.toHexString)(await this.vmManager.getContractStorage((0, utils_1.toFancyAddress)(this.contractAddress), (0, utils_1.fromHexString)(slotKeyPair.key)))) }))));
        return (0, storage_1.decodeVariable)(slotValueTypePairs);
    }
}
exports.ReadableStorageLogic = ReadableStorageLogic;
//# sourceMappingURL=readable-storage-logic.js.map