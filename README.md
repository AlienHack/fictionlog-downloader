![Fictionlog Downloader](https://i.imgur.com/Y5I4uvE.png)

# FictionLog Downloader
A simple tool to download purchased novel from fictionlog

## Demo
[https://fictionlog.nanobit.dev](https://fictionlog.nanobit.dev)

## Prerequisite
- NodeJS 14.x
- Nest CLI

## Installation
Install package using yarn

`yarn`

Run the tool

`yarn start`

## How to use [API]
0. Browse to `https://fictionlog.co`
1. Get your accessToken from browser's inspect function by right click -> inspect
2. Navigate to Application tab -> Cookies -> fictionlog.co
3. Copy your accessToken value
4. Open rename .env.example -> .env
5. Type your accessToken value into TOKEN variable `Eg. TOKEN=ABCDEFG`
6. Get novelId `Eg. https://fictionlog.co/b/60646c51042860001bd81466` novelId is `60646c51042860001bd81466`
7. Navigate to `http://localhost:3000/api/downloadBook/{novelId}`, replace {novelId} with your novel of choice `Eg. http://localhost:3000/api/downloadBook/60646c51042860001bd81466`
8. Profit $$$

## How to use [Client]
0. Browse to `https://fictionlog.co`
1. Get your accessToken from browser's inspect function by right click -> inspect
2. Navigate to Application tab -> Cookies -> fictionlog.co
3. Copy your accessToken value
4. Get novelId `Eg. https://fictionlog.co/b/60646c51042860001bd81466` novelId is `60646c51042860001bd81466`
5. Navigate to `http://localhost:3000`, input your novelId and accessToken, choose format and press download
6. Profit $$$
