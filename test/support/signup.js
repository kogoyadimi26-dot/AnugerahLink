'use strict';

// Pendaftaran tidak lagi mengembalikan token (agar tidak membocorkan email yang sudah terdaftar).
// Helper ini mendaftar, lalu masuk dengan kata sandi yang sama untuk mendapatkan token.
async function signupAndLogin(call, body) {
  const signup = await call('POST', '/api/buyer/signup', { body });
  const login = await call('POST', '/api/buyer/login', { body: { email: body.email, password: body.password } });
  const token = login.json.token || '';
  const me = token ? await call('GET', '/api/buyer/me', { token }) : { json: {} };
  return { signup, token, buyer: me.json.buyer || null };
}

module.exports = { signupAndLogin };
