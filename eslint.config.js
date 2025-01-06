import configs from "@kayahr/eslint-config";
import globals from "globals";

export default [
    {
        ignores: [
            "doc",
            "lib",
            "**/*.legacy.ts"
        ]
    },
    {
        languageOptions: {
            globals: {
                ...globals.browser,
                ...globals.node
            }
        }
    },
    ...configs
];
