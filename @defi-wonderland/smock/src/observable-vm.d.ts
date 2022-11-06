import { EVMResult } from '@nomicfoundation/ethereumjs-evm/dist/evm';
import { Message } from '@nomicfoundation/ethereumjs-evm/dist/message';
import { VM } from '@nomicfoundation/ethereumjs-vm';
import { Observable } from 'rxjs';
import { SmockVMManager } from './types';
export declare class ObservableVM {
    private vm;
    private beforeMessage$;
    private afterMessage$;
    constructor(vm: VM);
    getManager(): SmockVMManager;
    getBeforeMessages(): Observable<Message>;
    getAfterMessages(): Observable<EVMResult>;
    private static fromEvent;
}
