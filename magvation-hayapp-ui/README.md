# Magvation HayApp UI

Front-end for Magvation HayApp.
Test password is "password" until cloud integration

## Prerequisites
- Node.js 18+ (currently using 18.9.1)
- yarn or npm

## Install
```bash
yarn install
# or
npm install
```

## Run
```bash
yarn start
# or
npm run
```

## Possible Errors
If you run into a SUID error then run the following commands
```bash
cd /magvation-hayapp-ui/node_modules/electron/dist
sudo chown root:root chrome-sandbox
sudo chmod 4755 chrome-sandbox
```

## Lint and Prettier
Lint and Prettier are required for the build to succeed
```bash
yarn run lint
# or
npm run lint
```

```bash
yarn pretty --write
# or
npx prettier . -w
```