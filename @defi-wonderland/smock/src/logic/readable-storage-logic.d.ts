import { SmockVMManager } from '../types';
import { SolidityStorageLayout } from '../utils/storage';
export declare class ReadableStorageLogic {
    private storageLayout;
    private contractAddress;
    private vmManager;
    constructor(storageLayout: SolidityStorageLayout, vmManager: SmockVMManager, contractAddress: string);
    getVariable(variableName: string, mappingKeys?: string[] | number[]): Promise<unknown>;
}
