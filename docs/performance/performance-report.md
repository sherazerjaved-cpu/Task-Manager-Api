# Performance & Scale Load Test Report

## 1. Objective

Validate the Task Manager API's read performance under concurrent authenticated traffic and record:

- Requests per second (RPS)
- p95 latency
- p99 latency
- HTTP error rate
- Target performance thresholds

The primary workload tested the read-heavy task endpoint:

`GET /api/v1/tasks?workspaceId=<workspaceId>`

## 2. Test Tool

- Tool: k6
- Version: 2.2.0
- Execution: local
- API: NestJS application running locally
- MongoDB: Docker
- Redis: Docker
- Jaeger: Docker

## 3. Test Configuration

The benchmark used five authenticated users with different workspace roles:

| User | Role |
|---|---|
| Shezi | OWNER |
| Pihu | ADMIN |
| Waji | MEMBER |
| Haroon | MEMBER |
| Qasai | VIEWER |

Load profile:

- Executor: `constant-arrival-rate`
- Target rate: 5 iterations/second
- Duration: 60 seconds
- Pre-allocated VUs: 5
- Maximum VUs: 10
- Workspace-scoped task listing
- Authentication performed once during k6 setup

## 4. Target Thresholds

The following thresholds were targeted before the benchmark:

| Metric | Target |
|---|---:|
| HTTP error rate | `< 1%` |
| p95 latency | `< 750 ms` |
| p99 latency | `< 1000 ms` |

These thresholds were selected as initial practical targets for this local development benchmark and are not claims of maximum production capacity.

## 5. Benchmark Results

### Overall

| Metric | Result |
|---|---:|
| HTTP requests | 306 |
| Actual request rate | 4.865 req/s |
| HTTP error rate | 0.00% |
| Average latency | 31.58 ms |
| Median latency | 10.00 ms |
| p90 latency | 38.48 ms |
| p95 latency | 158.64 ms |
| p99 latency | 462.97 ms |
| Maximum latency | 696.12 ms |
| Completed iterations | 301 |
| Dropped iterations | 0 |

### Threshold evaluation

| Threshold | Result | Status |
|---|---:|---|
| HTTP error rate `< 1%` | 0.00% | PASS |
| p95 `< 750 ms` | 158.64 ms | PASS |
| p99 `< 1000 ms` | 462.97 ms | PASS |

## 6. k6 Outcome

The benchmark completed successfully with all configured thresholds passing:

- `http_req_failed < 1%` — PASS
- `p(95) < 750 ms` — PASS
- `p(99) < 1000 ms` — PASS

The k6 checks completed at 100% success for the login and task-list requests used by the benchmark.

## 7. Interpretation

At an intended workload of 5 requests/second for 60 seconds, the API sustained approximately 4.87 requests/second with zero HTTP failures.

The measured median latency was 10 ms, while p95 and p99 were 158.64 ms and 462.97 ms respectively. This indicates a fast common path with a smaller tail of slower requests.

The benchmark demonstrates that the current task-list implementation, Redis caching, MongoDB aggregation path, authorization checks, and surrounding request processing can handle the tested workload without exceeding the targeted latency or error thresholds.

This result should be treated as a **baseline**, not as a claimed maximum capacity of the API. The test was executed locally with Docker-backed MongoDB/Redis rather than on production-equivalent infrastructure.

## 8. Rate-Limiting Consideration

The normal application rate limits were intentionally not used to determine the raw performance capacity of the API during this benchmark.

For the performance run, the application was started with:

`LOAD_TEST=true`

This bypasses the global/user throttling specifically for the benchmark so that `429 Too Many Requests` responses do not dominate the performance measurements.

The normal rate limiting remains enabled when `LOAD_TEST` is not set.

A separate controlled multi-user test verified that the five workspace roles could successfully access the task-list endpoint, and earlier testing verified the application's `429` rate-limit behavior.

## 9. Reproduction

Start MongoDB and Redis:

`docker compose up -d mongo redis`

Start the API in load-test mode:

`$env:LOAD_TEST="true"`
`npm run start:dev`

Run:

`k6 run tests/load/tasks-performance.js`

## Load-Test Requirement

Status: **COMPLETE**

The required k6 load test, RPS measurement, p95/p99 measurements, and explicit performance thresholds have been documented above.

The separate Section 10 requirement for demonstrating N+1 avoidance should be documented alongside this report after that verification is completed.
