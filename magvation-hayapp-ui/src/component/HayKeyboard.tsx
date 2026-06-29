import React, { JSX, useEffect, useState } from "react";
import styles from "./HayKeyboard.module.css";

export enum Action {
    INPUT,
    SHIFT,
    BACKSPACE,
    ENTER,
}

interface iKey {
    value: string;
    shiftValue?: string | undefined;
    function?: Action;
    width?: number;
}

export class FullKey {
    value: string;
    shiftValue: string | undefined;
    function: Action;
    width: number;

    constructor(values: iKey) {
        this.value = values.value;
        this.shiftValue = values.shiftValue;
        this.function = values.function ? values.function : Action.INPUT;
        this.width = values.width ? values.width : 1;
    }
}

class Key extends FullKey {
    constructor(value: string) {
        super({ value: value });
    }
}

class SymbolKey extends FullKey {
    constructor(value: string, shiftValue: string) {
        super({ value: value, shiftValue: shiftValue });
    }
}

interface KeyboardProps {
    onKeyClicked?: (key: FullKey, shifted: boolean) => void;
    type?: KeyboardType;
}

export enum KeyboardType {
    Standard,
    Extended,
}

export const HayKeyboard: React.FC<KeyboardProps> = ({ onKeyClicked = () => {}, type = KeyboardType.Standard }) => {
    const standardKeys: FullKey[][] = [
        [
            new SymbolKey("`", "~"),
            new SymbolKey("1", "!"),
            new SymbolKey("2", "@"),
            new SymbolKey("3", "#"),
            new SymbolKey("4", "$"),
            new SymbolKey("5", "%"),
            new SymbolKey("6", "^"),
            new SymbolKey("7", "&"),
            new SymbolKey("8", "*"),
            new SymbolKey("9", "("),
            new SymbolKey("0", ")"),
            new SymbolKey("-", "_"),
            new SymbolKey("=", "+"),
        ],
        [
            new Key("q"),
            new Key("w"),
            new Key("e"),
            new Key("r"),
            new Key("t"),
            new Key("y"),
            new Key("u"),
            new Key("i"),
            new Key("o"),
            new Key("p"),
            new FullKey({ value: "backspace", function: Action.BACKSPACE, width: 3 }),
        ],
        [
            new Key("a"),
            new Key("s"),
            new Key("d"),
            new Key("f"),
            new Key("g"),
            new Key("h"),
            new Key("j"),
            new Key("k"),
            new Key("l"),
            new SymbolKey("'", '"'),
            new SymbolKey(",", "<"),
            new SymbolKey(".", ">"),
            new SymbolKey("/", "?"),
        ],
        [
            new FullKey({ value: "caps lock", function: Action.SHIFT, width: 3 }),
            new Key("z"),
            new Key("x"),
            new Key("c"),
            new Key("v"),
            new Key("b"),
            new Key("n"),
            new Key("m"),
            new FullKey({ value: "enter", function: Action.ENTER, width: 3 }),
        ],
        [new FullKey({ value: " ", width: 13 })],
    ];

    const extendedKeys: FullKey[][] = [
        [new Key("1"), new Key("2"), new Key("3")],
        [new Key("4"), new Key("5"), new Key("6")],
        [new Key("7"), new Key("8"), new Key("9")],
        [new Key("0"), new FullKey({ value: "enter", function: Action.ENTER, width: 2 })],
    ];

    const [keys, setKeys] = useState(standardKeys);

    useEffect(() => {
        if (type == KeyboardType.Standard) {
            setKeys(standardKeys);
            return;
        }

        const newKeys: FullKey[][] = [];
        for (let i = 0; i < standardKeys.length; i++) {
            newKeys.push([...standardKeys[i]]);
            if (extendedKeys[i]) {
                newKeys[i].push(...extendedKeys[i]);
            }
        }
        setKeys(newKeys);
    }, [type]);

    const [selectedKey, setSelectedKey] = useState<FullKey | undefined>(undefined);
    const [shifted, setShifted] = useState<boolean>(false);

    function onMouseUp(key: FullKey) {
        if (selectedKey && key.value == selectedKey.value) {
            onKeyClicked(key, shifted);
        }

        if (key.function == Action.SHIFT) {
            setShifted(!shifted);
        }

        setSelectedKey(undefined);
    }

    function renderRow(row: FullKey[]): JSX.Element {
        return (
            <div className={styles.row} key={Math.random()}>
                {row.map((key) => {
                    let className = styles.key;
                    if (key.value == selectedKey?.value) {
                        className += " " + styles.selected;
                    } else if (key.function == Action.SHIFT && shifted) {
                        className += " " + styles.selected;
                    }

                    let value = key.value;
                    if (shifted && !key.shiftValue && key.value.length == 1) {
                        value = key.value.toUpperCase();
                    }

                    return (
                        <div
                            className={className}
                            style={{ flexGrow: key.width }}
                            onMouseDown={() => {
                                setSelectedKey(key);
                            }}
                            onMouseUp={() => {
                                onMouseUp(key);
                            }}
                            onMouseLeave={() => {
                                setSelectedKey(undefined);
                            }}
                            key={Math.random()}
                        >
                            <div className={styles.keyInner}>
                                <div>{key.shiftValue ?? ""}</div>
                                <div>{value}</div>
                            </div>
                        </div>
                    );
                })}
            </div>
        );
    }

    let className = styles.wrapper;
    if (type == KeyboardType.Extended) {
        className += " " + styles.extended;
    }

    return (
        <div className={className}>
            <div className={styles.keyboard}>
                {keys.map((row) => {
                    return renderRow(row);
                })}
            </div>
        </div>
    );
};
