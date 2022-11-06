import { SmockVMManager } from '../types';
interface SolidityStorageObj {
    astId: number;
    contract: string;
    label: string;
    offset: number;
    slot: string;
    type: string;
}
interface SolidityStorageType {
    encoding: string;
    label: string;
    numberOfBytes: string;
    key?: string;
    value?: string;
    base?: string;
    members?: SolidityStorageObj[];
}
export interface SolidityStorageLayout {
    storage: SolidityStorageObj[];
    types: {
        [name: string]: SolidityStorageType;
    };
}
interface StorageSlotPair {
    key: string;
    val: string;
}
export interface StorageSlotKeyTypePair {
    key: string;
    type: SolidityStorageType;
    length?: number;
    label?: string;
    offset?: number;
}
export interface StorageSlotKeyValuePair {
    value: any;
    type: SolidityStorageType;
    length?: number;
    label?: string;
    offset?: number;
}
export declare function getStorageLayout(name: string): Promise<SolidityStorageLayout>;
export declare function computeStorageSlots(storageLayout: SolidityStorageLayout, variables?: any): Array<StorageSlotPair>;
export declare function getVariableStorageSlots(storageLayout: SolidityStorageLayout, variableName: string, vmManager: SmockVMManager, contractAddress: string, mappingKey?: any[] | number | string, baseSlotKey?: string, storageType?: SolidityStorageType): Promise<StorageSlotKeyTypePair[]>;
export declare function decodeVariable(slotValueTypePairs: StorageSlotKeyValuePair | StorageSlotKeyValuePair[]): any;
export {};
