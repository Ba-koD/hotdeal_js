# 봇 등록 방법
> 1. https://discord.com/developers/applications 에 들어가서 로그인후 적용하고 싶은 봇을 선택 / 생성한다
> 2. 원래 있던 봇 토큰을 입력하거나, 왼쪽 창에 Bot에 들어가 Reset Token을 한 후에 밑에 .token에 token에 입력한다.
> 3. 봇을 초대하려면 OAuth2에서 URL Generator에 들어가 SCOPES에서 bot을 클릭해준다.
> 4. BOT PERMISSIONS에서 Send Messages와 Read Messages/View Channels를 활성화 한다. (최소 권한, 이외 다른 권한 자유롭게 설정가능)
> 5. 그 위에있는 Privileged Gateway Intents에서 Message Intents, Server Members Intents를 활성화한다.
> ※ 추가기능을 언한다면 채널생성권한도 준다.

# 봇 사용방법
{} : 필수 명령어  
[] : 선택 명령어

```
서버 명령어
/채널지정 {채널 카테고리(자동으로 리스트 표시)} [채널 ID(#으로 해도되고 비워두면 권한 있을시 채널생성)]

DM 명령어
/키알등록 {키알1} [키알2] [키알3] [키알4] [키알5]
/키알리스트
```

- 키알 리스트로 키알 리스트 보기 가능, 밑에 뜨는 버튼으로 키알 제거도 가능
- 60초간 아무런 행동이 없을시 자동으로 리스트 닫힘

※ 키알이란 채널에서 알림을 받고싶은 상품의 키워드를 말한다.

# 봇 세팅 방법
1. `data`폴더의 `.token`에 봇 토큰을 입력하고, `hotdeal_js` 안에있는 `service_manager.sh`를 실행한다.
2. 직접 설치하여 사용하는경우 node와 npm, sqlite3를 설치한다.
```bash
sudo apt-get install nodejs=20.11.0 npm=10.2.4 sqlite3=3.37.2
```
3. Docker를 사용하는경우 docker와 docker-compose를 설치한다.
```bash
sudo apt-get install docker docker-compose
```
4. 설치가 완료되었다면 `service_manager.sh`를 실행한다.
```bash
./service_manager.sh
```
를 실행한다.
## 버전 정보
```bash
> node -v
v20.11.0

> npm -v
10.2.4

> npm list
hotdeal_js
├── axios@1.7.2
├── cheerio@1.0.0-rc.12
├── discord.js@14.15.3
└── sqlite3@5.1.7

> sqlite3 --version
3.37.2 2022-01-06 13:25:41 872ba256cbf61d9290b571c0e6d82a20c224ca3ad82971edc46b29818d5dalt1
```

# Last Updated
Last Updated: 2024-07-18 18:30:00