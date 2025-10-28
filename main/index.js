// main.com - OAuth 2.0 Client Application
const express = require('express');
const axios = require('axios');
const session = require('express-session');
const crypto = require('crypto');

const app = express();
app.use(express.json());
app.use(session({
  secret: 'session-secret-key',
  resave: false,
  saveUninitialized: true
}));

// OAuth 설정
const OAUTH_CONFIG = {
  client_id: 'main_app_12345',
  client_secret: 'secret_key_abc123xyz',
  authorization_endpoint: 'http://localhost:3000/oauth/authorize',
  token_endpoint: 'http://localhost:3000/oauth/token',
  userinfo_endpoint: 'http://localhost:3000/oauth/userinfo',
  redirect_uri: 'http://localhost:3001/callback',
  scope: 'profile email'
};

// 홈페이지
app.get('/', (req, res) => {
  if (req.session.user) {
    res.send(`
      <!DOCTYPE html>
      <html>
      <head><title>main.com</title></head>
      <body>
        <h1>Welcome to main.com</h1>
        <h2>Hello, ${req.session.user.name}!</h2>
        <p>Email: ${req.session.user.email}</p>
        <a href="/logout">Logout</a>
      </body>
      </html>
    `);
  } else {
    res.send(`
      <!DOCTYPE html>
      <html>
      <head><title>main.com</title></head>
      <body>
        <h1>Welcome to main.com</h1>
        <p>Please login to continue</p>
        <a href="/login">Login with accounts.com</a>
      </body>
      </html>
    `);
  }
});

// 1. 로그인 시작 - accounts.com으로 리다이렉트
app.get('/login', (req, res) => {
  // CSRF 방지를 위한 state 생성
  const state = crypto.randomBytes(16).toString('hex');
  req.session.oauth_state = state;

  // Authorization URL 생성
  const authUrl = new URL(OAUTH_CONFIG.authorization_endpoint);
  authUrl.searchParams.append('response_type', 'code');
  authUrl.searchParams.append('client_id', OAUTH_CONFIG.client_id);
  authUrl.searchParams.append('redirect_uri', OAUTH_CONFIG.redirect_uri);
  authUrl.searchParams.append('scope', OAUTH_CONFIG.scope);
  authUrl.searchParams.append('state', state);

  console.log('Redirecting to:', authUrl.toString());
  res.redirect(authUrl.toString());
});

// 2. Callback - accounts.com에서 돌아온 후 처리
app.get('/callback', async (req, res) => {
  const { code, state, error } = req.query;

  // 에러 처리
  if (error) {
    return res.status(400).send(`Authorization error: ${error}`);
  }

  // State 검증 (CSRF 방지)
  if (!state || state !== req.session.oauth_state) {
    return res.status(400).send('Invalid state parameter');
  }

  // Authorization code가 없으면 에러
  if (!code) {
    return res.status(400).send('No authorization code received');
  }

  try {
    // 3. Access Token 교환
    const tokenResponse = await axios.post(
      OAUTH_CONFIG.token_endpoint,
      new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: OAUTH_CONFIG.redirect_uri,
        client_id: OAUTH_CONFIG.client_id,
        client_secret: OAUTH_CONFIG.client_secret
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );

    const { access_token, refresh_token, expires_in } = tokenResponse.data;
    console.log('Access token received:', access_token.substring(0, 20) + '...');

    // 4. Access Token으로 사용자 정보 가져오기
    const userInfoResponse = await axios.get(
      OAUTH_CONFIG.userinfo_endpoint,
      {
        headers: {
          'Authorization': `Bearer ${access_token}`
        }
      }
    );

    const userInfo = userInfoResponse.data;
    console.log('User info received:', userInfo);

    // 세션에 사용자 정보 저장
    req.session.user = userInfo;
    req.session.access_token = access_token;
    req.session.refresh_token = refresh_token;

    // 홈으로 리다이렉트
    res.redirect('/');

  } catch (error) {
    console.error('OAuth error:', error.response?.data || error.message);
    res.status(500).send('Authentication failed: ' + (error.response?.data?.error || error.message));
  }
});

// Protected Route 예제
app.get('/api/profile', async (req, res) => {
  if (!req.session.access_token) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    // Access Token으로 API 호출
    const response = await axios.get(
      OAUTH_CONFIG.userinfo_endpoint,
      {
        headers: {
          'Authorization': `Bearer ${req.session.access_token}`
        }
      }
    );

    res.json(response.data);
  } catch (error) {
    if (error.response?.status === 401) {
      // Token이 만료된 경우 - 실제로는 refresh token으로 갱신
      req.session.destroy();
      return res.status(401).json({ error: 'Token expired, please login again' });
    }
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// 로그아웃
app.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/');
});

app.listen(3001, () => {
  console.log('main.com running on http://localhost:3001');
  console.log('Visit http://localhost:3001 to start OAuth flow');
});
