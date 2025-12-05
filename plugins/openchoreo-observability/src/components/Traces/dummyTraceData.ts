import { Trace as TraceData } from './WaterfallView';

export const dummyTracesData: TraceData[] = [
  {
    traceId: '63d7c3065ab25375e6c5d6bb135a77db',
    spans: [
      {
        durationInNanos: 123000000,
        endTime: '2025-12-02T09:41:36.513607313Z',
        name: 'HTTP POST /api/v1/checkout',
        spanId: '7e971bb1becc2438',
        startTime: '2025-12-02T09:41:32.713484313Z',
      },
      {
        durationInNanos: 123000000,
        endTime: '2025-12-02T09:41:33.713607313Z',
        name: 'validation svc',
        spanId: '72f86d75190dd683',
        startTime: '2025-12-02T09:41:32.713607313Z',
        parentSpanId: '7e971bb1becc2438',
      },
      {
        durationInNanos: 2000000000,
        endTime: '2025-12-02T09:41:35.713607313Z',
        name: 'inventory service',
        spanId: '82f86d75190dd684',
        startTime: '2025-12-02T09:41:33.713607313Z',
        parentSpanId: '7e971bb1becc2438',
      },
      {
        durationInNanos: 500000000,
        endTime: '2025-12-02T09:41:34.213607313Z',
        name: 'DB Read',
        spanId: '92f86d75190dd685',
        startTime: '2025-12-02T09:41:33.713607313Z',
        parentSpanId: '82f86d75190dd684',
      },
      {
        durationInNanos: 300000000,
        endTime: '2025-12-02T09:41:35.013607313Z',
        name: 'DB Update',
        spanId: 'a2f86d75190dd686',
        startTime: '2025-12-02T09:41:34.713607313Z',
        parentSpanId: '82f86d75190dd684',
      },
      {
        durationInNanos: 800000000,
        endTime: '2025-12-02T09:41:36.513607313Z',
        name: 'payment service',
        spanId: 'b2f86d75190dd687',
        startTime: '2025-12-02T09:41:35.713607313Z',
        parentSpanId: '7e971bb1becc2438',
      },
    ],
  },
  {
    traceId: '7d7c3065ab25375e6c5d6bb135a77db',
    spans: [
      {
        durationInNanos: 3000000000,
        endTime: '2025-12-02T09:42:02.713607313Z',
        name: 'HTTP GET /api/v1/products',
        spanId: 'c2f86d75190dd688',
        startTime: '2025-12-02T09:41:32.713607313Z',
      },
      {
        durationInNanos: 1500000000,
        endTime: '2025-12-02T09:42:02.713607313Z',
        name: 'product service',
        spanId: 'd2f86d75190dd689',
        startTime: '2025-12-02T09:41:32.713607313Z',
        parentSpanId: 'c2f86d75190dd688',
      },
      {
        durationInNanos: 500000000,
        endTime: '2025-12-02T09:41:37.713607313Z',
        name: 'cache lookup',
        spanId: 'e2f86d75190dd68a',
        startTime: '2025-12-02T09:41:32.713607313Z',
        parentSpanId: 'd2f86d75190dd689',
      },
    ],
  },
  {
    traceId: '8d7c3065ab25375e6c5d6bb135a77db',
    spans: [
      {
        durationInNanos: 1000000000,
        endTime: '2025-12-02T09:41:33.713607313Z',
        name: 'HTTP POST /api/v1/auth',
        spanId: 'f2f86d75190dd68b',
        startTime: '2025-12-02T09:41:32.713607313Z',
      },
      {
        durationInNanos: 800000000,
        endTime: '2025-12-02T09:41:33.513607313Z',
        name: 'auth service',
        spanId: '12f86d75190dd68c',
        startTime: '2025-12-02T09:41:32.713607313Z',
        parentSpanId: 'f2f86d75190dd68b',
      },
    ],
  },
  {
    traceId: '9d7c3065ab25375e6c5d6bb135a77db',
    spans: [
      {
        durationInNanos: 2000000000,
        endTime: '2025-12-02T09:41:34.713607313Z',
        name: 'HTTP PUT /api/v1/users',
        spanId: '22f86d75190dd68d',
        startTime: '2025-12-02T09:41:32.713607313Z',
      },
      {
        durationInNanos: 1500000000,
        endTime: '2025-12-02T09:41:34.213607313Z',
        name: 'user service',
        spanId: '32f86d75190dd68e',
        startTime: '2025-12-02T09:41:32.713607313Z',
        parentSpanId: '22f86d75190dd68d',
      },
      {
        durationInNanos: 500000000,
        endTime: '2025-12-02T09:41:33.213607313Z',
        name: 'validation',
        spanId: '42f86d75190dd68f',
        startTime: '2025-12-02T09:41:32.713607313Z',
        parentSpanId: '32f86d75190dd68e',
      },
      {
        durationInNanos: 300000000,
        endTime: '2025-12-02T09:41:33.513607313Z',
        name: 'DB Write',
        spanId: '52f86d75190dd690',
        startTime: '2025-12-02T09:41:33.213607313Z',
        parentSpanId: '32f86d75190dd68e',
      },
    ],
  },
  {
    traceId: '10d7c3065ab25375e6c5d6bb135a77db',
    spans: [
      {
        durationInNanos: 1000000000,
        endTime: '2025-12-02T09:41:33.713607313Z',
        name: 'HTTP POST /api/v1/auth',
        spanId: 'f2f86d75190dd68b',
        startTime: '2025-12-02T09:41:32.713607313Z',
      },
    ],
  },
  {
    traceId: '11d7c3065ab25375e6c5d6bb135a77db',
    spans: [
      {
        durationInNanos: 1000000000,
        endTime: '2025-12-02T09:41:33.713607313Z',
        name: 'HTTP POST /api/v1/auth',
        spanId: 'f2f86d75190dd68b',
        startTime: '2025-12-02T09:41:32.713607313Z',
      },
    ],
  },
];
