import React from "react";
import styles from "./CategoryBadge.module.css";
import { useTranslation } from "react-i18next";
import OpenIcon from "../img/Open.svg";
import ClosingIcon from "../img/ClosingNeedle.svg";
import JITIcon from "../img/JIT.svg";

export type SutureNeedleCategory = "Open" | "Closing" | "JIT";

interface CategoryBadgeProps {
    category: SutureNeedleCategory;
}

export const CategoryBadge: React.FC<CategoryBadgeProps> = ({ category }) => {
    const { t } = useTranslation();

    const getCategoryConfig = (cat: SutureNeedleCategory) => {
        switch (cat) {
            case "Open":
                return {
                    label: t("components.categoryBadge.open", { defaultValue: "Open" }),
                    icon: OpenIcon,
                    containerClass: styles.openContainer,
                    iconClass: styles.openIcon,
                };
            case "Closing":
                return {
                    label: t("components.categoryBadge.closing", { defaultValue: "Closing" }),
                    icon: ClosingIcon,
                    containerClass: styles.closingContainer,
                    iconClass: styles.closingIcon,
                };
            case "JIT":
                return {
                    label: t("components.categoryBadge.jit", { defaultValue: "JIT" }),
                    icon: JITIcon,
                    containerClass: styles.jitContainer,
                    iconClass: styles.jitIcon,
                };
            default:
                return { label: cat, icon: null, containerClass: "", iconClass: "" };
        }
    };

    const config = getCategoryConfig(category);

    return (
        <div className={styles.badge}>
            {config.icon && (
                <div className={config.containerClass}>
                    <img src={config.icon} alt={config.label} className={config.iconClass} />
                </div>
            )}
            <span className={styles.label}>{config.label}</span>
        </div>
    );
};
