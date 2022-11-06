import { ethers } from 'ethers';
export declare function convertStructToPojo(struct: any): object;
export declare function convertPojoToStruct(value: Record<string, unknown>, fnFragment: ethers.utils.FunctionFragment): unknown[];
export declare function convertPojoToStructRecursive(value: any, fnFragments: Partial<ethers.utils.ParamType>[]): unknown[][];
export declare function getObjectAndStruct(obj1: unknown, obj2: unknown): [object, unknown[]] | undefined;
export declare function isStruct(obj: unknown): boolean;
export declare function isPojo(obj: unknown): boolean;
