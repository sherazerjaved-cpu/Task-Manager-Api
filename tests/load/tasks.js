import http from 'k6/http';
import { check, fail } from 'k6';
import { sleep } from 'k6';

export const options = {
  vus: 5,
  duration: '10s',
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

const workspaceId = __ENV.K6_WORKSPACE_ID;

export function setup() {
  const tokens = [];

  for (const user of users) {
    const loginResponse = http.post(
      'http://localhost:3000/api/v1/auth/login',
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

    const loginOk = check(loginResponse, {
      [`${user.role} login status is 201`]: (r) => r.status === 201,

      [`${user.role} returned access token`]: (r) => {
        try {
          return !!r.json('access_token');
        } catch {
          return false;
        }
      },
    });

    if (!loginOk) {
      fail(
        `${user.role} login failed: ${loginResponse.status} ${loginResponse.body}`,
      );
    }

    tokens.push({
      accessToken: loginResponse.json('access_token'),
      role: user.role,
    });
  }

  return {
    tokens,
    workspaceId,
  };
}

export default function (data) {
  const user = data.tokens[__VU - 1];

  const response = http.get(
    `http://localhost:3000/api/v1/tasks?workspaceId=${data.workspaceId}`,
    {
      headers: {
        Authorization: `Bearer ${user.accessToken}`,
      },
    },
  );

  const taskListOk = check(response, {
    [`${user.role} task list status is 200`]: (r) => r.status === 200,
  });

  if (!taskListOk) {
    console.log(
      `\n${user.role} TASK REQUEST FAILED\n` +
        `Status: ${response.status}\n` +
        `Body: ${response.body}\n`,
    );
  }

  sleep(1);
}