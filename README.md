# Info
이메일/비밀번호 로그인과 소셜 로그인 시 Oauth 2.0 에 대한 이해를 Javascript 코드로 기록
<br /><br /><br />

# Description

### Oauth 2.0 이란
OAuth 2.0은 하나의 서비스가 다른 서비스에게 인증과 권한을 안전하게 위임하기 위한 표준 프로토콜입니다.
<br /><br />

### 구현 정의
아래와 같이 도메인 서비스를 2개 구현합니다.
- 계정 서비스 도메인 accounts.com (포트: 3000)
- 메인 서비스 도메인 main.com (포트: 3001)

계정 서비스 도메인 -> 메인 서비스 도메인으로 인증과 권한을 안전히 위임합니다.


### 구현 흐름

**(Email, Password) Login Flow**
1. 사용자가 main.com에 접속
2. 로그인 클릭 시 main.com/login 호출
3. main.com/login 에서 (GET)accounts.com/oauth/authorize 으로 URL에 OauthConfig 정보를 담아서 리다이렉트
4. (GET)accounts.com/oauth/authorize 에서 email, password 입력 후 (POST)accounts.com/oauth/authorize 호출
5. (POST)accounts.com/oauth/authorize에서 authorizeCode를 발급 및 캐시에 저장 후 main.com/callback 으로 URL에 authorizeCode, state 정보를 담아서 리다이렉트
6. main.com/callback에서 (POST)accounts.com/oauth/token 와 (GET)accounts.com/oauth/userinfo 를 순서대로 axios 로 요청
    - (POST)accounts.com/oauth/token 요청 시 accessToken 을 만들고 accounts.com 캐시에 저장 후, main.com/callback에 전달
    - (GET) accounts.com/oauth/userinfo 요청 시 accessToken 값을 토대로 유저 정보를 응답받고, main.com은 세션에 유저 정보 저장
7. 이후 accessToken 값으로 main.com 세션에서 유저 정보 사용
<br />

**(Social) Login Flow - 미구현 및 참고용**
1. 사용자가 main.com에 접속
2. 로그인 클릭 시 main.com/login 호출
3. main.com/login 에서 (GET)accounts.com/oauth/authorize 으로 URL에 OauthConfig 정보를 담아서 리다이렉트
4. (GET)accounts.com/oauth/authorize 에서 소셜 로그인 진행
  - 소셜 로그인 제공자에게 옵션 값을 제공하고, 해당 소셜 로그인 진행 (redirect_uri: (GET)accounts.com/oauth/authorize)
  - 소셜 로그인 완료 후 redirect_uri로 ID token 과 함께 돌아옴
  - ID token 값에 있는 유저 정보를 토대로 유저의 회원가입, 회원연동, 로그인 등 분기점 생성 및 처리
5. (POST)accounts.com/oauth/authorize에서 authorizeCode를 발급 및 캐시에 저장 후 main.com/callback 으로 URL에 authorizeCode, state 정보를 담아서 리다이렉트
6. main.com/callback에서 (POST)accounts.com/oauth/token 와 (GET)accounts.com/oauth/userinfo 를 순서대로 axios 로 요청
    - (POST)accounts.com/oauth/token 요청 시 accessToken 을 만들고 accounts.com 캐시에 저장 후, main.com/callback에 전달
    - (GET) accounts.com/oauth/userinfo 요청 시 accessToken 값을 토대로 유저 정보를 응답받고, main.com은 세션에 유저 정보 저장
7. 이후 accessToken 값으로 main.com 세션에서 유저 정보 사용

### How to run
```
1. accounts
  1-1. cd accounts
  1-2. npm install
  1-3. node ./index.js
2. main
  2-1. cd main
  2-2. npm install
  2-3. node ./index.js

이후 구현 흐름 재현하기
```
