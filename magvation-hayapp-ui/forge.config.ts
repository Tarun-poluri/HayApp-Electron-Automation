import type { ForgeConfig } from "@electron-forge/shared-types";
import { MakerSquirrel } from "@electron-forge/maker-squirrel";
import { MakerZIP } from "@electron-forge/maker-zip";
import { MakerDeb } from "@electron-forge/maker-deb";
import { MakerRpm } from "@electron-forge/maker-rpm";
import { PublisherGithub } from "@electron-forge/publisher-github";
import { VitePlugin } from "@electron-forge/plugin-vite";
import { FusesPlugin } from "@electron-forge/plugin-fuses";
import { FuseV1Options, FuseVersion } from "@electron/fuses";

const config: ForgeConfig = {
    packagerConfig: {
        asar: true,
        executableName: "HayApp",
        icon: "assets/app-icon.ico",
        appCopyright: "© 2026 Magvation. All rights reserved.",
        extraResource: ["broker"],
        win32metadata: {
            CompanyName: "Magvation",
            ProductName: "HayApp",
            FileDescription: "HayApp",
            OriginalFilename: "HayApp.exe",
            InternalName: "HayApp",
        },
    },
    rebuildConfig: {},
    makers: [
        new MakerSquirrel({
            name: "HayApp",
            setupIcon: "assets/app-icon.ico",
        }),
        new MakerZIP({}, ["darwin"]),
        new MakerRpm({}),
        new MakerDeb({}),
    ],
    publishers: [
        new PublisherGithub({
            repository: {
                owner: "Tarun-poluri",
                name: "HayApp-Releases",
            },
            prerelease: false,
            draft: false,
            generateReleaseNotes: true,
        }),
    ],
    plugins: [
        new VitePlugin({
            build: [
                {
                    entry: "src/main.ts",
                    config: "vite.main.config.ts",
                    target: "main",
                },
                {
                    entry: "src/preload.ts",
                    config: "vite.preload.config.ts",
                    target: "preload",
                },
            ],
            renderer: [
                {
                    name: "main_window",
                    config: "vite.renderer.config.ts",
                },
            ],
        }),
        new FusesPlugin({
            version: FuseVersion.V1,
            [FuseV1Options.RunAsNode]: false,
            [FuseV1Options.EnableCookieEncryption]: true,
            [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
            [FuseV1Options.EnableNodeCliInspectArguments]: false,
            [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
            [FuseV1Options.OnlyLoadAppFromAsar]: true,
        }),
    ],
};

export default config;
