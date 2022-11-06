"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createMockContractFactory = exports.createFakeContract = void 0;
const ethers_1 = require("ethers");
const hardhat_1 = require("hardhat");
const operators_1 = require("rxjs/operators");
const editable_storage_logic_1 = require("../logic/editable-storage-logic");
const programmable_function_logic_1 = require("../logic/programmable-function-logic");
const readable_storage_logic_1 = require("../logic/readable-storage-logic");
const sandbox_1 = require("../sandbox");
const utils_1 = require("../utils");
const storage_1 = require("../utils/storage");
async function createFakeContract(vm, address, contractInterface, provider) {
    const fake = (await initContract(vm, address, contractInterface, provider));
    const contractFunctions = getContractFunctionsNameAndSighash(contractInterface, Object.keys(fake.functions));
    contractFunctions.forEach(([sighash, name]) => {
        const { encoder, calls$, results$ } = getFunctionEventData(vm, contractInterface, fake.address, sighash);
        const functionLogic = new programmable_function_logic_1.SafeProgrammableContract(name, calls$, results$, encoder);
        fillProgrammableContractFunction(fake[name], functionLogic);
    });
    return fake;
}
exports.createFakeContract = createFakeContract;
function mockifyContractFactory(vm, contractName, factory) {
    const realDeploy = factory.deploy;
    factory.deploy = async (...args) => {
        const mock = await realDeploy.apply(factory, args);
        const contractFunctions = getContractFunctionsNameAndSighash(mock.interface, Object.keys(mock.functions));
        contractFunctions.forEach(([sighash, name]) => {
            const { encoder, calls$, results$ } = getFunctionEventData(vm, mock.interface, mock.address, sighash);
            const functionLogic = new programmable_function_logic_1.ProgrammableFunctionLogic(name, calls$, results$, encoder);
            fillProgrammableContractFunction(mock[name], functionLogic);
        });
        const editableStorage = new editable_storage_logic_1.EditableStorageLogic(await (0, storage_1.getStorageLayout)(contractName), vm.getManager(), mock.address);
        const readableStorage = new readable_storage_logic_1.ReadableStorageLogic(await (0, storage_1.getStorageLayout)(contractName), vm.getManager(), mock.address);
        mock.setVariable = editableStorage.setVariable.bind(editableStorage);
        mock.setVariables = editableStorage.setVariables.bind(editableStorage);
        mock.getVariable = readableStorage.getVariable.bind(readableStorage);
        mock.wallet = await (0, utils_1.impersonate)(mock.address);
        return mock;
    };
    const realConnect = factory.connect;
    factory.connect = (...args) => {
        const newFactory = realConnect.apply(factory, args);
        return mockifyContractFactory(vm, contractName, newFactory);
    };
    return factory;
}
async function createMockContractFactory(vm, contractName, signerOrOptions) {
    const factory = (await hardhat_1.ethers.getContractFactory(contractName, signerOrOptions));
    return mockifyContractFactory(vm, contractName, factory);
}
exports.createMockContractFactory = createMockContractFactory;
async function initContract(vm, address, contractInterface, provider) {
    const contract = new ethers_1.ethers.Contract(address, contractInterface, provider);
    await vm.getManager().putContractCode((0, utils_1.toFancyAddress)(contract.address), Buffer.from('00', 'hex'));
    contract.wallet = await (0, utils_1.impersonate)(contract.address);
    return contract;
}
function getFunctionEventData(vm, contractInterface, contractAddress, sighash) {
    const encoder = getFunctionEncoder(contractInterface, sighash);
    const calls$ = parseAndFilterBeforeMessages(vm.getBeforeMessages(), contractInterface, contractAddress, sighash);
    const results$ = vm.getAfterMessages().pipe((0, operators_1.withLatestFrom)(calls$), (0, operators_1.distinct)(([, call]) => call), (0, operators_1.map)(([answer]) => answer));
    return { encoder, calls$, results$ };
}
function getFunctionEncoder(contractInterface, sighash) {
    if (sighash === null) {
        return (values) => values;
    }
    else {
        return (values) => {
            const fnFragment = contractInterface.getFunction(sighash);
            try {
                return contractInterface.encodeFunctionResult(fnFragment, [values]);
            }
            catch (_a) {
                try {
                    return contractInterface.encodeFunctionResult(fnFragment, values);
                }
                catch (err) {
                    if ((0, utils_1.isPojo)(values)) {
                        return contractInterface.encodeFunctionResult(fnFragment, (0, utils_1.convertPojoToStruct)(values, fnFragment));
                    }
                    throw err;
                }
            }
        };
    }
}
function parseAndFilterBeforeMessages(messages$, contractInterface, contractAddress, sighash) {
    return messages$.pipe((0, operators_1.filter)((message) => {
        if (sighash === null) {
            return message.data.length === 0;
        }
        else {
            return (0, utils_1.toHexString)(message.data.slice(0, 4)) === sighash;
        }
    }), (0, operators_1.filter)((message) => {
        const target = message.delegatecall ? message.codeAddress : message.to;
        return (target === null || target === void 0 ? void 0 : target.toString().toLowerCase()) === contractAddress.toLowerCase();
    }), (0, operators_1.map)((message) => parseMessage(message, contractInterface, sighash)), (0, operators_1.share)());
}
function fillProgrammableContractFunction(fn, logic) {
    fn._watchable = logic;
    fn.atCall = logic.atCall.bind(logic);
    fn.getCall = logic.getCall.bind(logic);
    fn.returns = logic.returns.bind(logic);
    fn.returnsAtCall = logic.returnsAtCall.bind(logic);
    fn.reverts = logic.reverts.bind(logic);
    fn.revertsAtCall = logic.revertsAtCall.bind(logic);
    fn.whenCalledWith = logic.whenCalledWith.bind(logic);
    fn.reset = logic.reset.bind(logic);
}
function getContractFunctionsNameAndSighash(contractInterface, names) {
    let functions = {};
    names.forEach((name) => {
        const sighash = contractInterface.getSighash(name);
        if (!functions[sighash] || !name.includes('(')) {
            functions[sighash] = name;
        }
    });
    return [...Object.entries(functions), [null, 'fallback']];
}
function parseMessage(message, contractInterface, sighash) {
    return {
        args: sighash === null ? (0, utils_1.toHexString)(message.data) : getMessageArgs(message.data, contractInterface, sighash),
        nonce: sandbox_1.Sandbox.getNextNonce(),
        value: ethers_1.BigNumber.from(message.value.toString()),
        target: (0, utils_1.fromFancyAddress)(message.delegatecall ? message.codeAddress : message.to),
        delegatedFrom: message.delegatecall ? (0, utils_1.fromFancyAddress)(message.to) : undefined,
    };
}
function getMessageArgs(messageData, contractInterface, sighash) {
    try {
        return contractInterface.decodeFunctionData(contractInterface.getFunction(sighash).format(), (0, utils_1.toHexString)(messageData));
    }
    catch (err) {
        throw new Error(`Failed to decode message data: ${err}`);
    }
}
//# sourceMappingURL=smock-contract.js.map