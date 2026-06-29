import { useEffect, useState } from "react";

type cb<B> = (value: B) => void;

export class Listenable<A> {
    value: A;

    constructor(initial: A) {
        this.value = initial;
    }

    set(value: A) {
        this.value = value;
        this.onListener(this.value);
    }

    private onListener: cb<A> = () => {};
    on(listener: cb<A>) {
        this.onListener = listener;
    }
}

export class MultiListenable<A> {
    value: A;
    notifyOnlyIfChanged: boolean;

    constructor(initial: A, notifyOnlyIfChanged = false) {
        this.value = initial;
        this.notifyOnlyIfChanged = notifyOnlyIfChanged;
    }

    set(value: A) {
        if (this.value == value && this.notifyOnlyIfChanged) {
            return;
        }

        this.value = value;

        for (const listener of this.listeners) {
            listener(this.value);
        }
    }

    protected listeners: cb<A>[] = [];
    addListener(listener: cb<A>) {
        this.listeners.push(listener);
    }

    removeListener(listener: cb<A>) {
        const idx = this.listeners.findIndex((value) => {
            return value == listener;
        });
        if (idx > -1) {
            this.listeners.splice(idx, 1);
        }
    }
}

export class MultiSignal extends MultiListenable<void> {
    constructor() {
        super(undefined, false);
    }

    signal() {
        this.set(undefined);
    }
}

export function useListenable<B>(target: MultiListenable<B>) {
    const [value, setValue] = useState<B>(target.value);
    useEffect(() => {
        const callback: cb<B> = (newValue) => {
            setValue(newValue);
        };

        target.addListener(callback);

        return () => {
            target.removeListener(callback);
        };
    }, []);

    return value;
}
