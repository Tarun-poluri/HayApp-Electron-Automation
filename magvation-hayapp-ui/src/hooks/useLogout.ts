import { useContext } from "react";
import { AppContext } from "../view/App";

interface LogoutOptions {
    shouldRestartCount?: boolean;
    shouldNavigateToSetup?: boolean;
    shouldReturnToCirSetup?: boolean;
    skipRoleSelection?: boolean;
}

interface LogoutResult {
    success: boolean;
    error?: string;
    at_least_one_still_logged_in?: boolean;
}

export const useLogout = () => {
    const appContext = useContext(AppContext);

    const logout = async (role: "CIR" | "SCR", options?: LogoutOptions): Promise<LogoutResult> => {
        try {
            console.log(`Logging out ${role}...`);
            const result = await appContext.caseService.parlayInterface.caseManager.logout_user(role);

            if (result.success) {
                console.log(`Logout successful for ${role}`, result);

                // Explicitly clear the user from frontend state
                if (role === "CIR") {
                    appContext.caseService.circulator.set(undefined);
                } else {
                    appContext.caseService.scrub.set(undefined);
                }

                // Handle navigation to setup if requested
                if (options?.shouldNavigateToSetup) {
                    // Set flag to restart count from Start step after re-login
                    if (options?.shouldRestartCount) {
                        appContext.caseService.shouldRestartCount.set(true);
                    }

                    // Set which role needs to re-login
                    appContext.caseService.reloginRole.set(role);

                    // Set flag to return to CIR setup after re-login (only when at Start step or later)
                    appContext.caseService.shouldReturnToCirSetup.set(!!options?.shouldReturnToCirSetup);

                    // Set flag to skip role selection (go straight to scan badge)
                    appContext.caseService.skipRoleSelection.set(!!options?.skipRoleSelection);

                    // Navigate to setup
                    appContext.navigate({ path: "setup" });
                }

                return {
                    success: true,
                    at_least_one_still_logged_in: result.at_least_one_still_logged_in,
                };
            } else {
                console.error("Logout failed:", result.error);
                return { success: false, error: result.error };
            }
        } catch (error) {
            console.error("Error during logout:", error);
            return { success: false, error: String(error) };
        }
    };

    return { logout };
};
