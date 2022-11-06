import { Address } from '@nomicfoundation/ethereumjs-util/dist/address';
import { HardhatNetworkProvider } from 'hardhat/internal/hardhat-network/provider/provider';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
export declare const getHardhatBaseProvider: (runtime: HardhatRuntimeEnvironment) => Promise<HardhatNetworkProvider>;
export declare const toFancyAddress: (address: string) => Address;
export declare const fromFancyAddress: (fancyAddress: Address) => string;
