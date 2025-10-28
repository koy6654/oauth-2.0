// accounts.com - OAuth 2.0 Authorization Server
const express = require('express');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 데이터 저장소 (실제로는 DB 사용)
const clients = {
  'main_app_12345': {
    client_secret: 'secret_key_abc123xyz',
    redirect_uris: ['http://localhost:3001/callback'],
    name: 'Main App'
  }
};

const users = {
  'user@example.com': {
    password: 'password123',
    id: 'user_001',
    name: 'John Doe',
    email: 'user@example.com'
  }
};

const authorizationCodes = {}; // {code: {client_id, user_id, redirect_uri, expires_at}}
const accessTokens = {}; // {token: {user_id, client_id, expires_at, scope}}

const JWT_SECRET = 'your-jwt-secret-key';
const CODE_EXPIRY = 10 * 60 * 1000; // 10분
const TOKEN_EXPIRY = 60 * 60 * 1000; // 1시간

// 1. Authorization Endpoint
// main.com이 사용자를 이 엔드포인트로 리다이렉트
app.get('/oauth/authorize', (req, res) => {
  const { response_type, client_id, redirect_uri, scope, state } = req.query;

  // 파라미터 검증
  if (response_type !== 'code') {
    return res.status(400).send('Unsupported response_type');
  }

  const client = clients[client_id];
  if (!client) {
    return res.status(400).send('Invalid client_id');
  }

  if (!client.redirect_uris.includes(redirect_uri)) {
    return res.status(400).send('Invalid redirect_uri');
  }

  // 실제로는 로그인 페이지 렌더링
  // 여기서는 간단히 HTML 폼으로 표현
  res.send(`
    <!DOCTYPE html>
    <html>
    <head><title>Login - accounts.com</title></head>
    <body>
      <h2>accounts.com에 로그인</h2>
      <p><strong>${client.name}</strong>이(가) 다음 권한을 요청합니다:</p>
      <ul>
        ${(scope || 'profile').split(' ').map(s => `<li>${s}</li>`).join('')}
      </ul>
      <form method="POST" action="/oauth/authorize">
        <input type="hidden" name="client_id" value="${client_id}">
        <input type="hidden" name="redirect_uri" value="${redirect_uri}">
        <input type="hidden" name="scope" value="${scope || 'profile'}">
        <input type="hidden" name="state" value="${state || ''}">
        
        <label>Email: <input type="email" name="email" required></label><br>
        <label>Password: <input type="password" name="password" required></label><br>
        <button type="submit">로그인 및 승인</button>
      </form>
    </body>
    </html>
  `);
});

// 2. 로그인 및 승인 처리
app.post('/oauth/authorize', (req, res) => {
  const { email, password, client_id, redirect_uri, scope, state } = req.body;

  // 사용자 인증
  const user = users[email];
  if (!user || user.password !== password) {
    return res.status(401).send('Invalid credentials');
  }

  // Authorization Code 생성
  const code = crypto.randomBytes(32).toString('hex');
  authorizationCodes[code] = {
    client_id,
    user_id: user.id,
    redirect_uri,
    scope,
    expires_at: Date.now() + CODE_EXPIRY
  };

  // Redirect back to main.com with code
  const redirectUrl = new URL(redirect_uri);
  redirectUrl.searchParams.append('code', code);
  if (state) redirectUrl.searchParams.append('state', state);

  res.redirect(redirectUrl.toString());
});

// 3. Token Endpoint
// main.com이 authorization code를 access token으로 교환
app.post('/oauth/token', (req, res) => {
  const { grant_type, code, redirect_uri, client_id, client_secret } = req.body;

  // Grant type 검증
  if (grant_type !== 'authorization_code') {
    return res.status(400).json({ error: 'unsupported_grant_type' });
  }

  // Client 인증
  const client = clients[client_id];
  if (!client || client.client_secret !== client_secret) {
    return res.status(401).json({ error: 'invalid_client' });
  }

  // Authorization Code 검증
  const authCode = authorizationCodes[code];
  if (!authCode) {
    return res.status(400).json({ error: 'invalid_grant' });
  }

  if (authCode.client_id !== client_id) {
    return res.status(400).json({ error: 'invalid_grant' });
  }

  if (authCode.redirect_uri !== redirect_uri) {
    return res.status(400).json({ error: 'invalid_grant' });
  }

  if (Date.now() > authCode.expires_at) {
    delete authorizationCodes[code];
    return res.status(400).json({ error: 'invalid_grant' });
  }

  // Code는 일회용
  delete authorizationCodes[code];

  // Access Token 생성 (JWT 사용)
  const accessToken = jwt.sign(
    {
      user_id: authCode.user_id,
      client_id: client_id,
      scope: authCode.scope
    },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

  // Refresh Token 생성
  const refreshToken = crypto.randomBytes(32).toString('hex');

  // Token 저장
  accessTokens[accessToken] = {
    user_id: authCode.user_id,
    client_id: client_id,
    scope: authCode.scope,
    expires_at: Date.now() + TOKEN_EXPIRY
  };

  res.json({
    access_token: accessToken,
    token_type: 'Bearer',
    expires_in: 3600,
    refresh_token: refreshToken,
    scope: authCode.scope
  });
});

// 4. User Info Endpoint (Resource Server)
// Access Token으로 사용자 정보 조회
app.get('/oauth/userinfo', (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'invalid_token' });
  }

  const token = authHeader.substring(7);

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const userId = decoded.user_id;

    // 사용자 정보 조회
    const user = Object.values(users).find(u => u.id === userId);
    if (!user) {
      return res.status(404).json({ error: 'user_not_found' });
    }

    // scope에 따라 반환할 정보 결정
    const scopes = decoded.scope.split(' ');
    const userInfo = { id: user.id };

    if (scopes.includes('profile')) {
      userInfo.name = user.name;
    }
    if (scopes.includes('email')) {
      userInfo.email = user.email;
    }

    res.json(userInfo);
  } catch (error) {
    res.status(401).json({ error: 'invalid_token' });
  }
});

app.listen(3000, () => {
  console.log('accounts.com OAuth Server running on http://localhost:3000');
});
