import { SetVariablesType, SmockVMManager } from '../types';
import { SolidityStorageLayout } from '../utils/storage';
export declare class EditableStorageLogic {
    private storageLayout;
    private contractAddress;
    private vmManager;
    constructor(storageLayout: SolidityStorageLayout, vmManager: SmockVMManager, contractAddress: string);
    setVariable(variableName: string, value: any): Promise<void>;
    setVariables(variables: SetVariablesType): Promise<void>;
}
