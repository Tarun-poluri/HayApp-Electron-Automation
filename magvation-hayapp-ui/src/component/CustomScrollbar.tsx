import React, { useRef, useState, useEffect, useLayoutEffect, useCallback } from "react";
import localStyles from "./CustomScrollbar.module.css";
import UpArrowIcon from "../img/UpArrow.svg";
import DownArrowIcon from "../img/DownArrow.svg";

// Helper to calculate dynamic values based on screen width (similar to vw)
// Assuming base design width is 1920px
const getDynamicValue = (basePx: number) => {
    return (basePx / 1920) * window.innerWidth;
};

interface CustomScrollbarProps {
    targetRef: React.RefObject<HTMLElement | null>;
    thumbHeight: number;
    dependency?: unknown;
    styles: { readonly [key: string]: string };
    containerStyle?: React.CSSProperties;
}

export const CustomScrollbar: React.FC<CustomScrollbarProps> = ({ targetRef, dependency, styles, containerStyle }) => {
    const scrollBarBackRef = useRef<HTMLDivElement>(null);
    const arrowRef = useRef<HTMLDivElement>(null);
    const [thumbTop, setThumbTop] = useState(0);
    const [thumbHeightState, setThumbHeightState] = useState(100);
    const [arrowMetrics, setArrowMetrics] = useState({ height: 60, gap: 5 });
    // Track thumb gap in state so it updates on resize
    const [thumbGap, setThumbGap] = useState(() => getDynamicValue(20));

    // Unified update function that recalculates everything
    const updateAll = useCallback(() => {
        const content = targetRef.current;
        const scrollBarBack = scrollBarBackRef.current;
        const arrow = arrowRef.current;
        if (!content || !scrollBarBack || !arrow) return;

        // Recalculate dynamic values based on current window size
        const currentThumbGap = getDynamicValue(20);
        setThumbGap(currentThumbGap);

        const arrowHeight = arrow.clientHeight;
        const gap = arrow.offsetTop;

        // Update arrow metrics state
        setArrowMetrics({ height: arrowHeight, gap });

        const { scrollTop, scrollHeight, clientHeight } = content;
        const backHeight = scrollBarBack.clientHeight;
        const trackHeight = backHeight - 2 * (arrowHeight + gap + currentThumbGap);

        if (trackHeight <= 0) return;

        const ratio = clientHeight / scrollHeight;
        const minThumbHeight = getDynamicValue(40);
        const thumbH = Math.max(ratio * trackHeight, minThumbHeight);
        const maxThumbTop = trackHeight - thumbH;

        const scrollableHeight = scrollHeight - clientHeight;
        const thumbT = scrollableHeight > 0 ? (scrollTop / scrollableHeight) * maxThumbTop : 0;

        setThumbHeightState(thumbH);
        setThumbTop(thumbT);
    }, [targetRef]);

    // Use useLayoutEffect to ensure measurements happen after DOM updates
    useLayoutEffect(() => {
        updateAll();
    }, [updateAll, dependency]);

    useEffect(() => {
        const content = targetRef.current;
        const scrollBarBack = scrollBarBackRef.current;
        if (!content) return;

        // Handle scroll events
        content.addEventListener("scroll", updateAll);

        // Handle window resize
        window.addEventListener("resize", updateAll);

        // Use ResizeObserver for the scrollbar container and content
        const resizeObserver = new ResizeObserver(() => {
            // Use requestAnimationFrame to batch updates
            requestAnimationFrame(updateAll);
        });

        if (scrollBarBack) {
            resizeObserver.observe(scrollBarBack);
        }
        resizeObserver.observe(content);

        return () => {
            content.removeEventListener("scroll", updateAll);
            window.removeEventListener("resize", updateAll);
            resizeObserver.disconnect();
        };
    }, [targetRef, updateAll, dependency]);

    useEffect(() => {
        const scrollBarBack = scrollBarBackRef.current;
        const content = targetRef.current;
        if (!scrollBarBack || !content) return;

        const onWheel = (e: WheelEvent) => {
            e.preventDefault();
            content.scrollBy({ top: e.deltaY });
        };

        scrollBarBack.addEventListener("wheel", onWheel, { passive: false });
        return () => {
            scrollBarBack.removeEventListener("wheel", onWheel);
        };
    }, [targetRef]);

    const scrollBy = (delta: number) => {
        if (targetRef.current) {
            targetRef.current.scrollBy({ top: delta, behavior: "smooth" });
        }
    };

    const onThumbMouseDown = (e: React.MouseEvent) => {
        e.preventDefault();
        const startY = e.clientY;
        const startTop = thumbTop;
        const content = targetRef.current;
        const scrollBarBack = scrollBarBackRef.current;
        const arrow = arrowRef.current;
        if (!content || !scrollBarBack || !arrow) return;

        const arrowHeight = arrow.clientHeight;
        const gap = arrow.offsetTop;
        const currentThumbGap = getDynamicValue(20);

        const backHeight = scrollBarBack.clientHeight;
        const trackHeight = backHeight - 2 * (arrowHeight + gap + currentThumbGap);
        const maxThumbTop = trackHeight - thumbHeightState;

        const onMouseMove = (moveEvent: MouseEvent) => {
            const dy = moveEvent.clientY - startY;
            const newThumbTop = Math.min(Math.max(startTop + dy, 0), maxThumbTop);
            setThumbTop(newThumbTop);

            const scrollRatio = newThumbTop / maxThumbTop;
            content.scrollTop = scrollRatio * (content.scrollHeight - content.clientHeight);
        };

        const onMouseUp = () => {
            window.removeEventListener("mousemove", onMouseMove);
            window.removeEventListener("mouseup", onMouseUp);
        };

        window.addEventListener("mousemove", onMouseMove);
        window.addEventListener("mouseup", onMouseUp);
    };

    const onThumbTouchStart = (e: React.TouchEvent) => {
        e.preventDefault();
        const startY = e.touches[0].clientY;
        const startTop = thumbTop;
        const content = targetRef.current;
        const scrollBarBack = scrollBarBackRef.current;
        const arrow = arrowRef.current;
        if (!content || !scrollBarBack || !arrow) return;

        const arrowHeight = arrow.clientHeight;
        const gap = arrow.offsetTop;
        const currentThumbGap = getDynamicValue(20);

        const backHeight = scrollBarBack.clientHeight;
        const trackHeight = backHeight - 2 * (arrowHeight + gap + currentThumbGap);
        const maxThumbTop = trackHeight - thumbHeightState;

        const onTouchMove = (moveEvent: TouchEvent) => {
            const dy = moveEvent.touches[0].clientY - startY;
            const newThumbTop = Math.min(Math.max(startTop + dy, 0), maxThumbTop);
            setThumbTop(newThumbTop);

            const scrollRatio = newThumbTop / maxThumbTop;
            content.scrollTop = scrollRatio * (content.scrollHeight - content.clientHeight);
        };

        const onTouchEnd = () => {
            window.removeEventListener("touchmove", onTouchMove);
            window.removeEventListener("touchend", onTouchEnd);
        };

        window.addEventListener("touchmove", onTouchMove);
        window.addEventListener("touchend", onTouchEnd);
    };

    return (
        <div className={`${localStyles.scrollBarContainer} ${styles.scrollIndicators || ""}`} style={containerStyle}>
            <div className={localStyles.scrollBarBack} ref={scrollBarBackRef}>
                <div
                    className={`${localStyles.arrowContainer} ${localStyles.top}`}
                    onClick={() => scrollBy(-getDynamicValue(60))}
                    ref={arrowRef}
                >
                    <img className={localStyles.arrow} src={UpArrowIcon} alt="Arrow" />
                </div>
                <div
                    className={localStyles.scrollBar}
                    style={{
                        top: arrowMetrics.height + arrowMetrics.gap + thumbGap + thumbTop,
                        height: `${thumbHeightState}px`,
                    }}
                    onMouseDown={onThumbMouseDown}
                    onTouchStart={onThumbTouchStart}
                />
                <div
                    className={`${localStyles.arrowContainer} ${localStyles.bottom}`}
                    onClick={() => scrollBy(getDynamicValue(60))}
                >
                    <img className={localStyles.arrow} src={DownArrowIcon} alt="Arrow" />
                </div>
            </div>
        </div>
    );
};
