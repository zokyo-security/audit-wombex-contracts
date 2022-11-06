"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ObservableVM = void 0;
const rxjs_1 = require("rxjs");
const operators_1 = require("rxjs/operators");
class ObservableVM {
    constructor(vm) {
        if (!vm)
            throw new Error('VM is not defined');
        this.vm = vm;
        this.beforeMessage$ = ObservableVM.fromEvent(vm, 'beforeMessage');
        this.afterMessage$ = ObservableVM.fromEvent(vm, 'afterMessage');
    }
    getManager() {
        return this.vm.stateManager;
    }
    getBeforeMessages() {
        return this.beforeMessage$.pipe((0, operators_1.filter)((message) => !!message.to));
    }
    getAfterMessages() {
        return this.afterMessage$;
    }
    static fromEvent(vm, eventName) {
        var _a;
        const subject = new rxjs_1.Subject();
        (_a = vm.evm?.events) === null || _a === void 0 ? void 0 : _a.on(eventName, (event) => subject.next(event));
        return subject.asObservable().pipe((0, operators_1.share)());
    }
}
exports.ObservableVM = ObservableVM;
//# sourceMappingURL=observable-vm.js.map