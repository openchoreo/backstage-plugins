# Runtime Logs API Reference

## API Endpoint
```
POST /api/logs/component/{componentId}
```

## Sample Request
```bash
xh POST :9090/api/logs/component/greeter-service \
  namespace=dp-default-default-development-f8e58905 \
  environmentId=development \
  logLevels:='["DEBUG"]' \
  startTime="2025-07-16T08:00:00Z" \
  endTime="2025-07-16T10:00:00Z"
```

## Sample Response
```json
{
    "logs": [
        {
            "timestamp": "2025-07-16T09:02:07.58Z",
            "log": "2025-07-16T09:02:07.343001654Z stderr F 2025/07/16 09:02:07 Shutting down the server...",
            "logLevel": "INFO",
            "componentId": "greeter-service",
            "environmentId": "development",
            "projectId": "default",
            "version": "",
            "versionId": "",
            "namespace": "dp-default-default-development-f8e58905",
            "podId": "c4f7f56b-1be7-407b-9418-08100fce510b",
            "containerName": "main",
            "labels": {
                "component-name": "greeter-service",
                "environment-name": "development",
                "organization-name": "default",
                "pod-template-hash": "7477dd45b",
                "project-name": "default"
            }
        }
    ],
    "totalCount": 9,
    "tookMs": 510
}
```

---

# Runtime Logs Feature Implementation Plan

## Overview
Create a comprehensive runtime logs page for the Choreo Backstage plugin with infinite scroll, filtering capabilities, and real-time log viewing.

## 1. API Layer Implementation

### 1.1 API Service (`src/api/runtime-logs.ts`)
- **Function**: `getRuntimeLogs(entity, discovery, identity, params)`
- **Parameters**: 
  - `logLevel`: filter by log level (ERROR, WARN, INFO, DEBUG)
  - `environmentId`: filter by environment
  - `startTime`: time range start
  - `endTime`: time range end
  - `limit`: pagination limit (default 50)
  - `offset`: pagination offset for infinite scroll
- **Authentication**: Bearer token from identity API
- **URL Construction**: Dynamic backend URL using discovery API
- **Error Handling**: Proper error handling with user-friendly messages

### 1.2 Environment API Service (`src/api/environments.ts`)
- **Function**: `getEnvironments(entity, discovery, identity)`
- **Purpose**: Fetch available environments for dropdown filter
- **Return**: Array of environment objects with id and name

## 2. Component Structure

### 2.1 Main Component (`src/components/RuntimeLogs/RuntimeLogs.tsx`)
```
RuntimeLogs/
├── RuntimeLogs.tsx          # Main component with layout
├── LogsFilter.tsx           # Filter controls component
├── LogsTable.tsx            # Infinite scroll table
├── LogEntry.tsx             # Individual log entry component
├── types.ts                 # TypeScript interfaces
└── index.ts                 # Export barrel
```

### 2.2 Component Hierarchy
- **RuntimeLogs** (Main container)
  - **LogsFilter** (Filter controls)
  - **LogsTable** (Infinite scroll container)
    - **LogEntry** (Individual log items)

## 3. State Management

### 3.1 Main State Structure
```typescript
interface RuntimeLogsState {
  logs: LogEntry[];
  loading: boolean;
  error: string | null;
  filters: {
    logLevel: string[];
    environmentId: string;
    timeRange: string;
  };
  pagination: {
    hasMore: boolean;
    offset: number;
    limit: number;
  };
}
```

### 3.2 Custom Hooks
- **useRuntimeLogs**: Main data fetching hook
- **useInfiniteScroll**: Infinite scroll logic
- **useFilters**: Filter state management
- **useEnvironments**: Environment data fetching

## 4. Filter Implementation

### 4.1 Log Level Filter
- **Type**: Multi-select checkbox group
- **Options**: ERROR, WARN, INFO, DEBUG
- **Default**: All selected
- **UI**: Material-UI FormGroup with Checkboxes

### 4.2 Environment Filter
- **Type**: Single-select dropdown
- **Data Source**: Dynamic API call to get environments
- **Default**: First available environment
- **UI**: Material-UI Select component

### 4.3 Time Range Filter
- **Type**: Single-select dropdown
- **Options**: 
  - Last 10 minutes
  - Last 30 minutes
  - Last 1 hour
  - Last 24 hours
  - Last 7 days
  - Last 14 days
- **Default**: Last 1 hour
- **UI**: Material-UI Select component

## 5. Infinite Scroll Implementation

### 5.1 Scroll Detection
- **Library**: Custom React hook using Intersection Observer
- **Trigger**: When user scrolls to bottom 200px
- **Behavior**: Load next batch of logs automatically

### 5.2 Pagination Strategy
- **Initial Load**: 50 logs
- **Batch Size**: 25 logs per scroll
- **Loading States**: Show skeleton loader at bottom
- **Error Handling**: Retry mechanism for failed loads

### 5.3 Performance Optimization
- **Virtualization**: Consider react-window for large datasets
- **Debouncing**: Prevent rapid API calls
- **Caching**: Cache logs per filter combination

## 6. UI/UX Design

### 6.1 Layout Structure
```
┌─────────────────────────────────────────────────────┐
│ Page Header: "Runtime Logs"                        │
├─────────────────────────────────────────────────────┤
│ Filter Bar: [Log Level] [Environment] [Time Range] │
├─────────────────────────────────────────────────────┤
│ Log Table:                                          │
│ │ Timestamp | Level | Message | Container | Pod    │
│ │ 09:02:07  │ INFO  │ Server... │ main     │ c4f7f │
│ │ 09:02:07  │ INFO  │ HTTP...   │ main     │ c4f7f │
│ │ [Loading more logs...]                            │
└─────────────────────────────────────────────────────┘
```

### 6.2 Color Coding
- **ERROR**: Red background/border
- **WARN**: Orange background/border
- **INFO**: Blue background/border
- **DEBUG**: Gray background/border

### 6.3 Responsive Design
- **Mobile**: Stack filters vertically
- **Tablet**: Horizontal filter layout
- **Desktop**: Full table with all columns

## 7. Data Types

### 7.1 TypeScript Interfaces
```typescript
interface LogEntry {
  timestamp: string;
  log: string;
  logLevel: 'ERROR' | 'WARN' | 'INFO' | 'DEBUG';
  componentId: string;
  environmentId: string;
  projectId: string;
  namespace: string;
  podId: string;
  containerName: string;
  labels: Record<string, string>;
}

interface LogsResponse {
  logs: LogEntry[];
  totalCount: number;
  tookMs: number;
}

interface Environment {
  id: string;
  name: string;
}
```

## 8. Error Handling

### 8.1 API Error States
- **Network Error**: Show retry button
- **Authentication Error**: Redirect to login
- **Permission Error**: Show permission denied message
- **Server Error**: Show generic error with support info

### 8.2 Loading States
- **Initial Load**: Full page skeleton
- **Filter Changes**: Overlay loading indicator
- **Infinite Scroll**: Bottom loading indicator
- **Retry**: Button loading states

## 9. Testing Strategy

### 9.1 Unit Tests
- **Components**: Test rendering and user interactions
- **Hooks**: Test data fetching and state management
- **API**: Test request/response handling

### 9.2 Integration Tests
- **Filter Interactions**: Test filter combinations
- **Infinite Scroll**: Test loading behavior
- **Error Scenarios**: Test error handling flows

## 10. Performance Considerations

### 10.1 Optimization Techniques
- **Memoization**: useMemo for expensive computations
- **Debouncing**: Prevent excessive API calls
- **Lazy Loading**: Load components on demand
- **Virtual Scrolling**: For large datasets

### 10.2 Accessibility
- **Keyboard Navigation**: Full keyboard support
- **Screen Readers**: Proper ARIA labels
- **Focus Management**: Logical tab order
- **High Contrast**: Support for high contrast mode

## 11. Implementation Steps

1. **Create API service functions** for logs and environments
2. **Implement TypeScript interfaces** for type safety
3. **Build filter components** with Material-UI
4. **Create infinite scroll hook** with intersection observer
5. **Implement main RuntimeLogs component** with layout
6. **Add log entry component** with styling
7. **Integrate with Backstage routing** and navigation
8. **Add error handling** and loading states
9. **Implement responsive design** and accessibility
10. **Add unit and integration tests**
11. **Performance optimization** and code review

This plan provides a comprehensive roadmap for implementing a robust runtime logs feature with infinite scroll and filtering capabilities while maintaining consistency with the existing Choreo Backstage plugin architecture.


