const eslint = require("@eslint/js");
const tseslint = require("@typescript-eslint/eslint-plugin");
const tsparser = require("@typescript-eslint/parser");
const importPlugin = require("eslint-plugin-import");

module.exports = [
    {
        ignores: [
            "**/node_modules/**",
            "**/dist/**",
            "**/.vite/**",
            "**/out/**",
        ],
    },
    {
        files: ["**/*.ts", "**/*.tsx"],
        languageOptions: {
            parser: tsparser,
            parserOptions: {
                ecmaVersion: "latest",
                sourceType: "module",
            },
            globals: {
                // Browser globals
                window: "readonly",
                document: "readonly",
                console: "readonly",
                setTimeout: "readonly",
                clearTimeout: "readonly",
                setInterval: "readonly",
                clearInterval: "readonly",
                // Node globals
                process: "readonly",
                __dirname: "readonly",
                __filename: "readonly",
                Buffer: "readonly",
                module: "readonly",
                require: "readonly",
                exports: "readonly",
                global: "readonly",
            },
        },
        plugins: {
            "@typescript-eslint": tseslint,
            import: importPlugin,
        },
        rules: {
            ...eslint.configs.recommended.rules,
            ...tseslint.configs["eslint-recommended"].overrides[0].rules,
            ...tseslint.configs.recommended.rules,
            "@typescript-eslint/no-empty-function": "off",
        },
    },
];
