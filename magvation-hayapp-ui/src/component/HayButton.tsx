import { useEffect, useState } from "react";
import styles from "./HayButton.module.css";

interface HayButtonProps {
    label: string;
    onClick?: () => void;
    style?: React.CSSProperties;
    enabled?: boolean;
    selected?: boolean;
    classNameProps?: string;
}

export const HayButton: React.FC<HayButtonProps> = ({
    label,
    onClick = () => {},
    style = {},
    enabled = true,
    selected = false,
    classNameProps = "",
}) => {
    const [className, setClassName] = useState(styles.hayButton);
    const [shadeClass, setShadeClass] = useState("");

    useEffect(() => {
        if (enabled) {
            setShadeClass("");
        } else {
            setShadeClass(styles.shade);
        }
    }, [enabled]);

    useEffect(() => {
        let newClass = styles.hayButton;
        if (selected) newClass += ` ${styles.selected}`;
        setClassName(newClass);
    }, [selected]);

    return (
        <div className={shadeClass}>
            {enabled ? null : <div />}
            <div
                className={`${className} ${classNameProps}`}
                style={style}
                onMouseDown={() => {
                    if (!enabled) return;
                    setClassName(styles.hayButton + " " + styles.pressed + (selected ? ` ${styles.selected}` : ""));
                }}
                onMouseUp={() => {
                    setClassName(styles.hayButton + (selected ? ` ${styles.selected}` : ""));
                }}
                onClick={() => {
                    if (!enabled) return;
                    onClick();
                }}
            >
                <div className={styles.inner}>{label}</div>
            </div>
        </div>
    );
};
