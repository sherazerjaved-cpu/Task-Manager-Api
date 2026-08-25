import http from 'k6/http';
import { check, fail } from 'k6';
import { sleep } from 'k6';

export const options = {
  scenarios: {
    task_benchmark: {
      executor: 'constant-arrival-rate',
      rate: 5,
      timeUnit: '1s',
      duration: '60s',
      preAllocatedVUs: 5,
      maxVUs: 10,
    },
  },

  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<750', 'p(99)<1000'],
  },
};

const users = [
  {
    email: __ENV.K6_USER1_EMAIL,
    password: __ENV.K6_USER1_PASSWORD,
    role: 'OWNER',
  },
  {
    email: __ENV.K6_USER2_EMAIL,
    password: __ENV.K6_USER2_PASSWORD,
    role: 'ADMIN',
  },
  {
    email: __ENV.K6_USER3_EMAIL,
    password: __ENV.K6_USER3_PASSWORD,
    role: 'MEMBER',
  },
  {
    email: __ENV.K6_USER4_EMAIL,
    password: __ENV.K6_USER4_PASSWORD,
    role: 'MEMBER',
  },
  {
    email: __ENV.K6_USER5_EMAIL,
    password: __ENV.K6_USER5_PASSWORD,
    role: 'VIEWER',
  },
];

const BASE_URL = 'http://localhost:3000/api/v1';
const workspaceId = __ENV.K6_WORKSPACE_ID;

export function setup() {
  const tokens = [];

  for (const user of users) {
    const response = http.post(
      `${BASE_URL}/auth/login`,
      JSON.stringify({
        email: user.email,
        password: user.password,
      }),
      {
        headers: {
          'Content-Type': 'application/json',
        },
      },
    );

    const loginOk = check(response, {
      [`${user.role} login status is 201`]: (r) => r.status === 201,

      [`${user.role} access token exists`]: (r) => {
        try {
          return !!r.json('access_token');
        } catch {
          return false;
        }
      },
    });

    if (!loginOk) {
      fail(
        `${user.role} login failed: ${response.status} ${response.body}`,
      );
    }

    tokens.push({
      accessToken: response.json('access_token'),
      role: user.role,
    });
  }

  return {
    tokens,
    workspaceId,
  };
}

export default function (data) {
  const userIndex = (__ITER % data.tokens.length);
  const user = data.tokens[userIndex];

  const response = http.get(
    `${BASE_URL}/tasks?workspaceId=${data.workspaceId}`,
    {
      headers: {
        Authorization: `Bearer ${user.accessToken}`,
      },
      tags: {
        role: user.role,
      },
    },
  );

  check(response, {
    'task list status is 200': (r) => r.status === 200,
  });

  sleep(0.05);
}