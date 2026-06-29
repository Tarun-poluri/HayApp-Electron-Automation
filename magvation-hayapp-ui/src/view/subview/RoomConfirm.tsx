import React from "react";
import styles from "../subviewcss/roomConfirm.module.css";
import { useTranslation } from "react-i18next";
import { BasicHeader } from "../../component/BasicHeader";
import OperatingRoomImg from "../../img/OperatingRoom.svg";

interface RoomConfirmProps {
    roomName: string;
    onConfirm: () => void;
    onRescan: () => void;
    onBack: () => void;
}

export const RoomConfirm: React.FC<RoomConfirmProps> = ({ roomName, onConfirm, onBack }) => {
    const { t } = useTranslation();

    return (
        <div className={styles.container}>
            <BasicHeader title={t("setup.roomConfirm.headerTitle")} onBack={onBack} />
            <div className={styles.content}>
                <img src={OperatingRoomImg} className={styles.icon} alt="Room" />
                <div className={styles.roomName}>{roomName}</div>
                <button className={styles.confirmButton} onClick={onConfirm}>
                    {t("setup.roomConfirm.confirm")}
                </button>
            </div>
        </div>
    );
};
