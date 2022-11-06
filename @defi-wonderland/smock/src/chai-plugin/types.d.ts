import { BigNumber } from 'ethers';
import { WatchableContractFunction } from '../index';
declare global {
    export namespace Chai {
        interface Assertion {
            always: Assertion;
            called: Assertion;
            callCount(count: number): Assertion;
            calledOnce: Assertion;
            calledTwice: Assertion;
            calledThrice: Assertion;
            calledBefore(otherFn: WatchableContractFunction): Assertion;
            calledAfter(otherFn: WatchableContractFunction): Assertion;
            calledImmediatelyBefore(otherFn: WatchableContractFunction): Assertion;
            calledImmediatelyAfter(otherFn: WatchableContractFunction): Assertion;
            calledWith(...args: any[]): Assertion;
            calledWithValue(value: BigNumber): Assertion;
            calledOnceWith(...args: any[]): Assertion;
            delegatedFrom(delegatorAddress: string): Assertion;
        }
    }
}
