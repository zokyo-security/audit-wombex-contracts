"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.decodeVariable = exports.getVariableStorageSlots = exports.computeStorageSlots = exports.getStorageLayout = void 0;
const ethers_1 = require("ethers");
const hardhat_1 = require("hardhat");
const semver_1 = __importDefault(require("semver"));
const utils_1 = require("../utils");
async function getStorageLayout(name) {
    const { sourceName, contractName } = await hardhat_1.artifacts.readArtifactSync(name);
    const buildInfo = await hardhat_1.artifacts.getBuildInfo(`${sourceName}:${contractName}`);
    if (!buildInfo)
        throw new Error(`Build info not found for contract ${sourceName}:${contractName}`);
    const output = buildInfo.output.contracts[sourceName][contractName];
    if (!semver_1.default.satisfies(buildInfo.solcVersion, '>=0.4.x <0.9.x')) {
        throw new Error(`Storage layout for Solidity version ${buildInfo.solcVersion} not yet supported. Sorry!`);
    }
    if (!('storageLayout' in output)) {
        throw new Error(`Storage layout for ${name} not found. Did you forget to set the storage layout compiler option in your hardhat config? Read more: https://smock.readthedocs.io/en/latest/getting-started.html#enabling-mocks`);
    }
    return output.storageLayout;
}
exports.getStorageLayout = getStorageLayout;
function computeStorageSlots(storageLayout, variables = {}) {
    let slots = [];
    for (const [variableName, variableValue] of Object.entries(variables)) {
        const storageObj = storageLayout.storage.find((entry) => {
            return entry.label === variableName;
        });
        if (!storageObj) {
            throw new Error(`Variable name not found in storage layout: ${variableName}`);
        }
        slots = slots.concat(encodeVariable(variableValue, storageObj, storageLayout.types));
    }
    slots = slots.reduce((prevSlots, slot) => {
        const prevSlot = prevSlots.find((otherSlot) => {
            return otherSlot.key === slot.key;
        });
        if (prevSlot === undefined) {
            prevSlots.push(slot);
        }
        else {
            prevSlots = prevSlots.filter((otherSlot) => {
                return otherSlot.key !== prevSlot.key;
            });
            let mergedVal = '0x';
            const valA = (0, utils_1.remove0x)(slot.val);
            const valB = (0, utils_1.remove0x)(prevSlot.val);
            for (let i = 0; i < 64; i += 2) {
                const byteA = valA.slice(i, i + 2);
                const byteB = valB.slice(i, i + 2);
                if (byteA === '00' && byteB === '00') {
                    mergedVal += '00';
                }
                else if (byteA === '00' && byteB !== '00') {
                    mergedVal += byteB;
                }
                else if (byteA !== '00' && byteB === '00') {
                    mergedVal += byteA;
                }
                else if (byteA === 'ff' && byteB === 'ff') {
                    mergedVal += 'ff';
                }
                else if (byteA === 'ff' && byteB !== '00') {
                    mergedVal += byteB;
                }
                else if (byteA !== '00' && byteB === 'ff') {
                    mergedVal += byteA;
                }
                else {
                    throw new Error('detected badly encoded packed value, should not happen');
                }
            }
            prevSlots.push({
                key: slot.key,
                val: mergedVal,
            });
        }
        return prevSlots;
    }, []);
    return slots;
}
exports.computeStorageSlots = computeStorageSlots;
function padNumHexSlotValue(val, offset) {
    const bn = ethers_1.BigNumber.from(val);
    return ('0x' +
        (0, utils_1.bigNumberToHex)(bn)
            .padStart(64 - offset * 2, bn.isNegative() ? 'f' : '0')
            .padEnd(64, '0')
            .toLowerCase());
}
function padBytesHexSlotValue(val, offset) {
    return ('0x' +
        (0, utils_1.remove0x)(val)
            .padStart(64 - offset * 2, '0')
            .padEnd(64, '0')
            .toLowerCase());
}
function encodeVariable(variable, storageObj, storageTypes, nestedSlotOffset = 0, baseSlotKey) {
    let slotKey = '0x' +
        (0, utils_1.remove0x)(ethers_1.BigNumber.from(baseSlotKey || nestedSlotOffset)
            .add(ethers_1.BigNumber.from(parseInt(storageObj.slot, 10)))
            .toHexString()).padStart(64, '0');
    const variableType = storageTypes[storageObj.type];
    if (variableType.encoding === 'inplace') {
        if (variableType.label === 'address' || variableType.label.startsWith('contract')) {
            if (!ethers_1.ethers.utils.isAddress(variable)) {
                throw new Error(`invalid address type: ${variable}`);
            }
            return [
                {
                    key: slotKey,
                    val: padNumHexSlotValue(variable, storageObj.offset),
                },
            ];
        }
        else if (variableType.label === 'bool') {
            if (typeof variable === 'string') {
                if (variable === 'false') {
                    variable = false;
                }
                if (variable === 'true') {
                    variable = true;
                }
            }
            if (typeof variable !== 'boolean') {
                throw new Error(`invalid bool type: ${variable}`);
            }
            return [
                {
                    key: slotKey,
                    val: padNumHexSlotValue(variable ? '1' : '0', storageObj.offset),
                },
            ];
        }
        else if (variableType.label.startsWith('bytes')) {
            if (!ethers_1.ethers.utils.isHexString(variable, parseInt(variableType.numberOfBytes, 10))) {
                throw new Error(`invalid bytesN type`);
            }
            return [
                {
                    key: slotKey,
                    val: padBytesHexSlotValue((0, utils_1.remove0x)(variable).padEnd(parseInt(variableType.numberOfBytes, 10) * 2, '0'), storageObj.offset),
                },
            ];
        }
        else if (variableType.label.startsWith('uint') || variableType.label.startsWith('int')) {
            let valueLength = (0, utils_1.remove0x)(ethers_1.BigNumber.from(variable).toHexString()).length;
            if (variableType.label.startsWith('int')) {
                valueLength = (0, utils_1.remove0x)(ethers_1.BigNumber.from(variable).toHexString().slice(1)).length;
            }
            if (valueLength / 2 > parseInt(variableType.numberOfBytes, 10)) {
                throw new Error(`provided ${variableType.label} is too big: ${variable}`);
            }
            return [
                {
                    key: slotKey,
                    val: padNumHexSlotValue(variable, storageObj.offset),
                },
            ];
        }
        else if (variableType.label.startsWith('struct')) {
            let slots = [];
            for (const [varName, varVal] of Object.entries(variable)) {
                slots = slots.concat(encodeVariable(varVal, variableType.members.find((member) => {
                    return member.label === varName;
                }), storageTypes, nestedSlotOffset + parseInt(storageObj.slot, 10), baseSlotKey));
            }
            return slots;
        }
    }
    else if (variableType.encoding === 'bytes') {
        if (storageObj.offset !== 0) {
            throw new Error(`got offset for string/bytes type, should never happen`);
        }
        const bytes = storageObj.type === 'string' ? ethers_1.ethers.utils.toUtf8Bytes(variable) : (0, utils_1.fromHexString)(variable);
        if (bytes.length < 32) {
            return [
                {
                    key: slotKey,
                    val: ethers_1.ethers.utils.hexlify(ethers_1.ethers.utils.concat([
                        ethers_1.ethers.utils.concat([bytes, ethers_1.ethers.constants.HashZero]).slice(0, 31),
                        ethers_1.ethers.BigNumber.from(bytes.length * 2).toHexString(),
                    ])),
                },
            ];
        }
        else {
            let slots = [];
            slots = slots.concat({
                key: slotKey,
                val: padNumHexSlotValue(bytes.length * 2 + 1, 0),
            });
            for (let i = 0; i * 32 < bytes.length; i++) {
                let key = ethers_1.BigNumber.from(ethers_1.ethers.utils.keccak256(slotKey))
                    .add(ethers_1.BigNumber.from(i.toString(16)))
                    .toHexString();
                slots = slots.concat({
                    key: key,
                    val: ethers_1.ethers.utils.hexlify(ethers_1.ethers.utils.concat([bytes.slice(i * 32, i * 32 + 32), ethers_1.ethers.constants.HashZero]).slice(0, 32)),
                });
            }
            return slots;
        }
    }
    else if (variableType.encoding === 'mapping') {
        if (variableType.key === undefined || variableType.value === undefined) {
            throw new Error(`variable is a mapping but has no key field or has no value field: ${variableType}`);
        }
        let slots = [];
        for (const [varName, varVal] of Object.entries(variable)) {
            let key;
            if (variableType.key.startsWith('t_uint')) {
                key = ethers_1.BigNumber.from(varName).toHexString();
            }
            else if (variableType.key.startsWith('t_bytes')) {
                key = '0x' + (0, utils_1.remove0x)(varName).padEnd(64, '0');
            }
            else {
                key = varName;
            }
            const prevBaseSlotKey = baseSlotKey || padNumHexSlotValue(storageObj.slot, 0);
            const nextBaseSlotKey = ethers_1.ethers.utils.keccak256(padNumHexSlotValue(key, 0) + (0, utils_1.remove0x)(prevBaseSlotKey));
            slots = slots.concat(encodeVariable(varVal, {
                label: varName,
                offset: 0,
                slot: '0',
                type: variableType.value,
                astId: 0,
                contract: '',
            }, storageTypes, nestedSlotOffset + parseInt(storageObj.slot, 10), nextBaseSlotKey));
        }
        return slots;
    }
    else if (variableType.encoding === 'dynamic_array') {
        if (variableType.base === undefined) {
            throw new Error(`variable is an array but has no base: ${variableType}`);
        }
        let slots = [
            {
                key: slotKey,
                val: padNumHexSlotValue(variable.length, 0),
            },
        ];
        let numberOfBytes = 0;
        let nextBaseSlotKey = ethers_1.BigNumber.from(ethers_1.ethers.utils.keccak256(slotKey));
        if (variableType.base.startsWith('t_bool')) {
            numberOfBytes = 1;
        }
        else if (variableType.base.startsWith('t_uint') || variableType.base.startsWith('t_int')) {
            numberOfBytes = Number(variableType.base.replace(/\D/g, '')) / 8;
            numberOfBytes > 16 ? 0 : numberOfBytes;
        }
        let offset = -numberOfBytes;
        for (let i = 0; i < variable.length; i++) {
            if (numberOfBytes > 0) {
                offset += numberOfBytes;
                if (offset >= 32) {
                    offset = 0;
                    nextBaseSlotKey = nextBaseSlotKey.add(ethers_1.BigNumber.from(1));
                }
            }
            else {
                offset = 0;
                nextBaseSlotKey = ethers_1.BigNumber.from(ethers_1.ethers.utils.keccak256(slotKey)).add(ethers_1.BigNumber.from(i.toString(16)));
            }
            slots = slots.concat(encodeVariable(variable[i], {
                label: '',
                offset: offset,
                slot: '0',
                type: variableType.base,
                astId: 0,
                contract: '',
            }, storageTypes, nestedSlotOffset, nextBaseSlotKey.toHexString()));
        }
        return slots;
    }
    throw new Error(`unknown unsupported type ${variableType.encoding} ${variableType.label}`);
}
async function getVariableStorageSlots(storageLayout, variableName, vmManager, contractAddress, mappingKey, baseSlotKey, storageType) {
    const storageObj = storageLayout.storage.find((entry) => {
        return entry.label === variableName;
    });
    if (!storageObj) {
        throw new Error(`Variable name not found in storage layout: ${variableName}`);
    }
    const storageObjectType = storageType || storageLayout.types[storageObj.type];
    let slotKeysTypes = [];
    let key = baseSlotKey ||
        '0x' +
            (0, utils_1.remove0x)(ethers_1.BigNumber.from(0)
                .add(ethers_1.BigNumber.from(parseInt(storageObj.slot, 10)))
                .toHexString()).padStart(64, '0');
    if (storageObjectType.encoding === 'inplace') {
        if (storageObjectType.label.startsWith('struct')) {
            slotKeysTypes = getStructTypeStorageSlots(storageLayout, key, storageObjectType, storageObj);
        }
        else {
            slotKeysTypes = slotKeysTypes.concat({
                key: key,
                type: storageObjectType,
                offset: storageObj.offset,
                label: storageObj.label,
            });
        }
    }
    else if (storageObjectType.encoding === 'bytes') {
        slotKeysTypes = await getBytesTypeStorageSlots(vmManager, contractAddress, storageObjectType, storageObj, key);
    }
    else if (storageObjectType.encoding === 'mapping') {
        if (mappingKey === undefined) {
            throw new Error(`Mapping key must be provided to get variable value: ${variableName}`);
        }
        slotKeysTypes = await getMappingTypeStorageSlots(storageLayout, variableName, vmManager, contractAddress, key, storageObjectType, mappingKey);
    }
    else if (storageObjectType.encoding === 'dynamic_array') {
        slotKeysTypes = await getDynamicArrayTypeStorageSlots(vmManager, contractAddress, storageObjectType, key);
    }
    return slotKeysTypes;
}
exports.getVariableStorageSlots = getVariableStorageSlots;
function getStructTypeStorageSlots(storageLayout, key, storageObjectType, storageObj) {
    if (storageObjectType.members === undefined) {
        throw new Error(`There are no members in object type ${storageObjectType}`);
    }
    let slotKeysTypes = [];
    slotKeysTypes = slotKeysTypes.concat({
        key: key,
        type: storageObjectType,
        label: storageObj.label,
        offset: storageObj.offset,
    });
    slotKeysTypes = slotKeysTypes.concat(storageObjectType.members.map((member) => ({
        key: '0x' + (0, utils_1.remove0x)(ethers_1.BigNumber.from(key).add(ethers_1.BigNumber.from(member.slot)).toHexString()).padStart(64, '0'),
        type: storageLayout.types[member.type],
        label: member.label,
        offset: member.offset,
    })));
    return slotKeysTypes;
}
async function getBytesTypeStorageSlots(vmManager, contractAddress, storageObjectType, storageObj, key) {
    let slotKeysTypes = [];
    const bytesValue = (0, utils_1.toHexString)(await vmManager.getContractStorage((0, utils_1.toFancyAddress)(contractAddress), (0, utils_1.fromHexString)(key)));
    if (bytesValue.slice(-1) === '1') {
        const numberOfSlots = Math.ceil((parseInt(bytesValue, 16) - 1) / 32);
        for (let i = 0; i < numberOfSlots; i++) {
            slotKeysTypes = slotKeysTypes.concat({
                key: ethers_1.ethers.utils.keccak256(key) + i,
                type: storageObjectType,
                length: i + 1 <= numberOfSlots ? 32 : (parseInt(bytesValue, 16) - 1) % 32,
                label: storageObj.label,
                offset: storageObj.offset,
            });
        }
    }
    else {
        slotKeysTypes = slotKeysTypes.concat({
            key: key,
            type: storageObjectType,
            length: parseInt(bytesValue.slice(-2), 16),
            label: storageObj.label,
            offset: storageObj.offset,
        });
    }
    return slotKeysTypes;
}
async function getMappingTypeStorageSlots(storageLayout, variableName, vmManager, contractAddress, key, storageObjectType, mappingKey, baseSlotKey) {
    if (storageObjectType.key === undefined || storageObjectType.value === undefined) {
        throw new Error(`Variable is a mapping but has no key field or has no value field: ${storageObjectType}`);
    }
    mappingKey = mappingKey instanceof Array ? mappingKey : [mappingKey];
    let mappKey;
    if (storageObjectType.key.startsWith('t_uint')) {
        mappKey = ethers_1.BigNumber.from(mappingKey[0]).toHexString();
    }
    else if (storageObjectType.key.startsWith('t_bytes')) {
        mappKey = '0x' + (0, utils_1.remove0x)(mappingKey[0]).padEnd(64, '0');
    }
    else {
        mappKey = mappingKey[0];
    }
    const prevBaseSlotKey = baseSlotKey || key;
    let nextSlotKey = ethers_1.ethers.utils.keccak256(padNumHexSlotValue(mappKey, 0) + (0, utils_1.remove0x)(prevBaseSlotKey));
    let slotKeysTypes = [];
    mappingKey.shift();
    slotKeysTypes = slotKeysTypes.concat(await getVariableStorageSlots(storageLayout, variableName, vmManager, contractAddress, mappingKey, nextSlotKey, storageLayout.types[storageObjectType.value]));
    return slotKeysTypes;
}
async function getDynamicArrayTypeStorageSlots(vmManager, contractAddress, storageObjectType, key) {
    let slotKeysTypes = [];
    let arrayLength = parseInt((0, utils_1.toHexString)(await vmManager.getContractStorage((0, utils_1.toFancyAddress)(contractAddress), (0, utils_1.fromHexString)(key))), 16);
    key = ethers_1.ethers.utils.keccak256(key);
    for (let i = 0; i < arrayLength; i++) {
        let slotKey = ethers_1.BigNumber.from(key)
            .add(ethers_1.BigNumber.from(i.toString(16)))
            .toHexString();
        slotKeysTypes = slotKeysTypes.concat({
            key: slotKey,
            type: storageObjectType,
        });
    }
    return slotKeysTypes;
}
function decodeVariable(slotValueTypePairs) {
    slotValueTypePairs = slotValueTypePairs instanceof Array ? slotValueTypePairs : [slotValueTypePairs];
    let result = '';
    const numberOfBytes = parseInt(slotValueTypePairs[0].type.numberOfBytes) * 2;
    if (slotValueTypePairs[0].type.encoding === 'inplace') {
        if (slotValueTypePairs[0].type.label === 'address' || slotValueTypePairs[0].type.label.startsWith('contract')) {
            result = ethers_1.ethers.utils.getAddress('0x' + slotValueTypePairs[0].value.slice(0, numberOfBytes));
        }
        else if (slotValueTypePairs[0].type.label === 'bool') {
            result = slotValueTypePairs[0].value.slice(0, numberOfBytes) === '01' ? true : false;
        }
        else if (slotValueTypePairs[0].type.label.startsWith('bytes')) {
            result = '0x' + slotValueTypePairs[0].value.slice(0, numberOfBytes);
        }
        else if (slotValueTypePairs[0].type.label.startsWith('uint')) {
            let value = slotValueTypePairs[0].value;
            if (slotValueTypePairs[0].offset !== 0 && slotValueTypePairs[0].offset !== undefined) {
                value = value.slice(-slotValueTypePairs[0].type.numberOfBytes * 2 - slotValueTypePairs[0].offset * 2, -slotValueTypePairs[0].offset * 2);
            }
            result = ethers_1.BigNumber.from('0x' + value);
        }
        else if (slotValueTypePairs[0].type.label.startsWith('int')) {
            let intHex = slotValueTypePairs[0].value;
            if (intHex.slice(0, 1) === 'f') {
                intHex = (0, utils_1.fromHexString)('0x' + intHex);
                const mask = (0, utils_1.fromHexString)('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF');
                intHex = -ethers_1.BigNumber.from((0, utils_1.toHexString)((0, utils_1.xor)(intHex, mask))).add(ethers_1.BigNumber.from(1));
            }
            result = intHex;
        }
        else if (slotValueTypePairs[0].type.label.startsWith('struct')) {
            slotValueTypePairs.shift();
            let structObject = {};
            for (const member of slotValueTypePairs) {
                if (member.label === undefined) {
                    throw new Error(`label for ${member} is undefined`);
                }
                if (member.offset === undefined) {
                    throw new Error(`offset for ${member} is undefined`);
                }
                let value;
                if (member.type.label.startsWith('bytes')) {
                    value = member.value.slice(member.offset * 2, parseInt(member.type.numberOfBytes) * 2 + member.offset * 2);
                }
                else {
                    if (member.offset === 0)
                        value = member.value.slice(-member.type.numberOfBytes * 2);
                    else
                        value = member.value.slice(-member.type.numberOfBytes * 2 - member.offset * 2, -member.offset * 2);
                }
                structObject = Object.assign(structObject, {
                    [member.label]: decodeVariable({
                        value: value,
                        type: member.type,
                    }),
                });
                result = structObject;
            }
        }
    }
    else if (slotValueTypePairs[0].type.encoding === 'bytes') {
        for (const slotKeyPair of slotValueTypePairs) {
            if (slotKeyPair.length === undefined) {
                throw new Error(`length is undefined for bytes: ${slotValueTypePairs[0]}`);
            }
            if (slotKeyPair.length < 32) {
                result = '0x' + result.concat(slotKeyPair.value.slice(0, slotKeyPair.length));
            }
            else {
                result = (0, utils_1.remove0x)(result);
                result = '0x' + result.concat(slotKeyPair.value.slice(0, 32));
            }
        }
    }
    else if (slotValueTypePairs[0].type.encoding === 'mapping') {
        throw new Error(`Error in decodeVariable. Encoding: mapping.`);
    }
    else if (slotValueTypePairs[0].type.encoding === 'dynamic_array') {
        let arr = [];
        for (let i = 0; i < slotValueTypePairs.length; i++) {
            arr = arr.concat(decodeVariable({
                value: slotValueTypePairs[i].value,
                type: {
                    encoding: 'inplace',
                    label: slotValueTypePairs[i].type.label,
                    numberOfBytes: slotValueTypePairs[i].type.numberOfBytes,
                },
            }));
        }
        result = arr;
    }
    return result;
}
exports.decodeVariable = decodeVariable;
//# sourceMappingURL=storage.js.map