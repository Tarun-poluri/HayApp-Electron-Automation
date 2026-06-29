// i18next.d.ts
import "i18next";
import type commonEn from "./locales/en/translation.json";

interface I18nNamespaces {
    translation: typeof commonEn;
    // Add other namespaces here if you have them, e.g., 'anotherNamespace': typeof anotherNsEn;
}

declare module "i18next" {
    interface CustomTypeOptions {
        resources: I18nNamespaces;
    }
}
