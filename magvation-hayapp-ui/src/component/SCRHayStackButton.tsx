import React from "react";
import styles from "./SCRHayStackButton.module.css";
import YesColor from "../img/YesColor.svg";
import YesGray from "../img/YesGray.svg";
import ValidateColor from "../img/ValidateColor.svg";
import ValidateGray from "../img/ValidateGray.svg";
import ActionColor from "../img/ActionColor.svg";
import ActionGray from "../img/ActionGray.svg";
import NoColor from "../img/NoColor.svg";
import NoGray from "../img/NoGray.svg";

export type HayStackButtonType = "yes" | "validate" | "action" | "no";

const activeImages: Record<HayStackButtonType, string> = {
    yes: YesColor,
    validate: ValidateColor,
    action: ActionColor,
    no: NoColor,
};

const inactiveImages: Record<HayStackButtonType, string> = {
    yes: YesGray,
    validate: ValidateGray,
    action: ActionGray,
    no: NoGray,
};

const activeCircleStyles: Record<HayStackButtonType, string> = {
    yes: styles.buttonCircleYesActive,
    validate: styles.buttonCircleValidateActive,
    action: styles.buttonCircleActionActive,
    no: styles.buttonCircleNoActive,
};

interface SCRHayStackButtonProps {
    type: HayStackButtonType;
    active?: boolean;
    title?: string;
    circleClassName?: string;
    textClassName?: string;
    imageClassName?: string;
    onClick?: () => void;
}

const SCRHayStackButton: React.FC<SCRHayStackButtonProps> = ({
    type,
    active = false,
    title,
    circleClassName = "",
    textClassName = "",
    imageClassName = "",
    onClick,
}) => {
    const image = active ? activeImages[type] : inactiveImages[type];
    const colorClass = active ? activeCircleStyles[type] : styles.buttonCircle;
    const circleClass = `${styles.buttonCircleBase} ${colorClass}${circleClassName ? ` ${circleClassName}` : ``}`;

    return (
        <div className={styles.buttonContainer} onClick={onClick}>
            <div className={circleClass}>
                <img src={image} alt={title} className={imageClassName || undefined} />
            </div>
            {title && <span className={textClassName || styles.buttonTitle}>{title}</span>}
        </div>
    );
};

export default SCRHayStackButton;
