export type SettingsLeaveAction = () => void;

type SettingsLeaveHandler = (proceed: SettingsLeaveAction) => void;

let activeSettingsLeaveHandler: SettingsLeaveHandler | null = null;

export function registerSettingsLeaveHandler(handler: SettingsLeaveHandler): () => void {
    activeSettingsLeaveHandler = handler;
    return () => {
        if (activeSettingsLeaveHandler === handler) {
            activeSettingsLeaveHandler = null;
        }
    };
}

export function requestSettingsLeave(proceed: SettingsLeaveAction): void {
    if (activeSettingsLeaveHandler) {
        activeSettingsLeaveHandler(proceed);
        return;
    }
    proceed();
}
