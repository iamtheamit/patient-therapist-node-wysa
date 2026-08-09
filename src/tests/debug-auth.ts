import http from 'http';
import jwt from 'jsonwebtoken';
import app from '../app';
import { config } from '../config';

const token = jwt.sign({ sub: 'test-user', email: 'test@example.com', role: 'PATIENT' }, config.jwtSecret, {
  expiresIn: '1h',
});

const server = app.listen(4114, () => {
  const req = http.request(
    'http://127.0.0.1:4114/api/v1/appointments/series/test-series/cancel',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
    (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        console.log('status', res.statusCode);
        console.log('body', data);
        server.close();
      });
    }
  );

  req.on('error', (err) => {
    console.error('request error', err);
    server.close();
  });

  req.end();
});
