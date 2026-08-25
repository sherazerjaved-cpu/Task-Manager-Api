import http from 'k6/http';
import { check } from 'k6';

export const options = {
  vus: 5,
  duration: '10s',
};

export default function () {
  const response = http.get('http://localhost:3000/api/v1/health/ready');

  check(response, {
    'status is 200': (r) => r.status === 200,
  });
}