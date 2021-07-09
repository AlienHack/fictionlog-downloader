# FictionLog Downloader
A simple tool to download purchased novel from fictionlog

## Prerequisit
- NodeJS 14.x
- Nest CLI

## Installation
Install package using yarn
`yarn`
Run the tool
`yarn start`

## How to use
1. Get your accessToken from browser's inspect using right click -> inspect
2. Navigate to Application tab -> Cookies -> fictionlog.co
3. Copy your accessToken value
4. Open rename .env.example -> .env
5. Type your accessToken value into TOKEN variable `Eg. TOKEN=ABCDEFG`
6. Get novelId `Eg. https://fictionlog.co/b/60646c51042860001bd81466` novelId is `60646c51042860001bd81466`
7. Navigate to `http://localhost:3000/downloadBook/{novelId}`, replace {novelId} with your novel of choice `Eg. http://localhost:3000/downloadBook/60646c51042860001bd81466`
8. Profit $$$
