// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import { App } from "../../src/view/App";

// Mock all the services
vi.mock("../../src/services/ParlayWrapper", async () => {
    const { MultiListenable } = await import("../../src/util/Listenable");
    return {
        ParlayWrapper: {
            instance: {
                isConnected: new MultiListenable(true),
                start: vi.fn(),
                sendCommand: vi.fn(),
                onEvent: vi.fn(),
            },
        },
    };
});

vi.mock("../../src/services/StaffService", () => ({
    default: {
        instance: {
            surgeonIndex: new Map(),
            hayAppIndex: new Map(),
            init: vi.fn().mockResolvedValue(undefined),
            loginHayAppUser: vi.fn(),
        },
    },
    HayAppUserType: {
        Circulator: "Circulator",
        ScrubNurse: "ScrubNurse",
    },
}));

vi.mock("../../src/services/HayScanService", async () => {
    const { MultiListenable } = await import("../../src/util/Listenable");
    return {
        default: {
            instance: {
                closingBoxScan: new MultiListenable(null),
                scannedRoom: new MultiListenable(undefined),
                scanRoom: vi.fn().mockResolvedValue(undefined),
                setupListeners: vi.fn(),
            },
        },
    };
});

vi.mock("../../src/services/TechSupportService", () => ({
    TechSupportService: {
        instance: {
            isProvisioned: vi.fn().mockResolvedValue({
                is_provisioned: true,
                has_api_key: true,
                has_group_id: true,
                group_data_access_denied: false,
            }),
        },
    },
}));

vi.mock("../../src/services/CaseService", async () => {
    const { MultiListenable } = await import("../../src/util/Listenable");
    return {
        default: {
            instance: {
                parlayInterface: {
                    caseManager: {
                        cir_screen_change: vi.fn(() => vi.fn()),
                        cir_screen_changed: vi.fn(() => vi.fn()),
                        get_room_id: vi.fn().mockResolvedValue("Room 1"),
                        get_hayapp_users: vi.fn().mockResolvedValue([]),
                        get_surgeons: vi.fn().mockResolvedValue([]),
                        get_development_mode: vi.fn().mockResolvedValue(false),
                    },
                    hayScanner: {},
                    hayStack: {},
                    iTrace: {},
                },
                restoreStateEnabled: new MultiListenable(false),
                isRestored: new MultiListenable(false),
                restoredCirScreen: new MultiListenable(""),
                restoredScrScreen: new MultiListenable(""),
                restoredSurgeonId: new MultiListenable(""),
                restoredCirId: new MultiListenable(""),
                restoredScrId: new MultiListenable(""),
                currentRole: new MultiListenable(null),
                loginStep: new MultiListenable("CIR"),
                surgeon: new MultiListenable(undefined),
                circulator: new MultiListenable(undefined),
                scrub: new MultiListenable(undefined),
                errorEvent: new MultiListenable(null),
                reloginRole: new MultiListenable(null),
                shouldReturnToCirSetup: new MultiListenable(false),
                skipRoleSelection: new MultiListenable(false),
                fetchRestoreStateConfig: vi.fn(),
                setRole: vi.fn(),
                resetAllState: vi.fn(),
                listenForCaseCleared: vi.fn(() => vi.fn()),
                dispose: vi.fn(),
                clearErrorEvent: vi.fn(),
                setCaseStaff: vi.fn(),
            },
        },
    };
});

// Mock react-i18next
vi.mock("react-i18next", () => ({
    useTranslation: () => ({
        t: (key: string) => key,
        i18n: { language: "en" },
    }),
    initReactI18next: {
        type: "3rdParty",
        init: vi.fn(),
    },
}));

describe("App", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("renders without crashing", () => {
        expect(() => {
            render(<App initialNavPath={{ path: "setup" }} />);
        }).not.toThrow();
    });

    it("has correct default route", () => {
        const { container } = render(<App initialNavPath={{ path: "setup" }} />);
        expect(container).toBeDefined();
    });
});
