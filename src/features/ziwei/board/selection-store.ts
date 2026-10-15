import { useRef, useSyncExternalStore } from 'react';

/**
 * 选中宫位的极小外部状态。点宫位只通知订阅了它的几个组件（底色、选中描边与连线、
 * 详情条、详情页），页面本身和十二个宫格都不会因此重画。
 */
export interface ZiweiSelectionStore {
    get: () => number;
    set: (index: number) => void;
    subscribe: (listener: () => void) => () => void;
}

export function createZiweiSelectionStore(initial = -1): ZiweiSelectionStore {
    let value = initial;
    const listeners = new Set<() => void>();
    return {
        get: () => value,
        set: (next) => {
            if (next === value) {
                return;
            }
            value = next;
            listeners.forEach((listener) => listener());
        },
        subscribe: (listener) => {
            listeners.add(listener);
            return () => {
                listeners.delete(listener);
            };
        },
    };
}

const NOOP_SUBSCRIBE = () => () => undefined;

/**
 * 订阅选中宫位；-1 或无效序号时落到 fallback（命宫）。
 * paused 时停止订阅并停在上一次的值：收起后的详情页留在后台，点宫位不会叫醒它。
 */
export function useZiweiSelectedIndex(
    store: ZiweiSelectionStore,
    isValid: (index: number) => boolean,
    fallback: number,
    paused = false,
): number {
    const lastRef = useRef(store.get());
    const getPaused = () => lastRef.current;
    const raw = useSyncExternalStore(
        paused ? NOOP_SUBSCRIBE : store.subscribe,
        paused ? getPaused : store.get,
        paused ? getPaused : store.get,
    );
    if (!paused) {
        lastRef.current = raw;
    }
    return raw >= 0 && isValid(raw) ? raw : fallback;
}
