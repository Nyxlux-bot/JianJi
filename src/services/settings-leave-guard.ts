export type SettingsLeaveAction = () => void;

type SettingsLeaveHandler = (proceed: SettingsLeaveAction) => void;

let activeSettingsLeaveHandler: SettingsLeaveHandler | null = null;
let leaveGuarded = false;
const guardListeners = new Set<(guarded: boolean) => void>();

export function registerSettingsLeaveHandler(handler: SettingsLeaveHandler): () => void {
    activeSettingsLeaveHandler = handler;
    return () => {
        if (activeSettingsLeaveHandler === handler) {
            activeSettingsLeaveHandler = null;
            setSettingsLeaveGuarded(false);
        }
    };
}

export function setSettingsLeaveGuarded(guarded: boolean): void {
    if (leaveGuarded === guarded) return;
    leaveGuarded = guarded;
    guardListeners.forEach((listener) => listener(guarded));
}

export function getSettingsLeaveGuarded(): boolean {
    return leaveGuarded;
}

export function subscribeSettingsLeaveGuarded(listener: (guarded: boolean) => void): () => void {
    guardListeners.add(listener);
    return () => { guardListeners.delete(listener); };
}

export function requestSettingsLeave(proceed: SettingsLeaveAction): void {
    if (activeSettingsLeaveHandler) {
        activeSettingsLeaveHandler(proceed);
        return;
    }
    proceed();
}
