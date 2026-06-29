declare module "*.module.css" {
    const classes: { [key: string]: string };
    export default classes;
}

declare module "*.css";

declare module "*.png" {
    const value: string;
    export default value;
}

declare module "*.gif" {
    const value: string;
    export default value;
}

declare module "electron-squirrel-startup" {
    const started: boolean;
    export default started;
}
