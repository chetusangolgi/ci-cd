import http from 'k6/http';
import { check } from 'k6';

export const options = {
  scenarios: {
    checkout: { executor: 'per-vu-iterations', vus: 100, iterations: 1, maxDuration: '2m' }
  },
  thresholds: { http_req_failed: ['rate<0.01'], checks: ['rate>0.99'] }
};

const baseUrl = __ENV.STAGING_URL?.replace(/\/$/, '');
if (!baseUrl) throw new Error('STAGING_URL is required');

export default function () {
  const headers = { 'Content-Type': 'application/json', 'X-Cart-Id': `load_${__VU}_${Date.now()}` };
  const added = http.post(`${baseUrl}/cart/add`,
    JSON.stringify({ name: 'Load item', priceCents: 100, quantity: 1 }), { headers });
  check(added, { 'add returns 201': response => response.status === 201 });
  const checkedOut = http.post(`${baseUrl}/checkout`, '{}', { headers });
  check(checkedOut, {
    'checkout returns 200': response => response.status === 200,
    'checkout total is correct': response => response.json('totalCents') === 118
  });
}
