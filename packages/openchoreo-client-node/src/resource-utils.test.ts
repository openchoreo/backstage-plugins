import {
  getName,
  getNamespace,
  getUid,
  getCreatedAt,
  getLabels,
  getAnnotations,
  getLabel,
  getAnnotation,
  getDisplayName,
  getDescription,
  getConditions,
  getCondition,
  getConditionStatus,
  isReady,
} from './resource-utils';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const fullResource = {
  metadata: {
    name: 'my-resource',
    namespace: 'my-ns',
    uid: '550e8400-e29b-41d4-a716-446655440000',
    creationTimestamp: '2025-01-06T10:00:00Z',
    labels: { app: 'backend', tier: 'api' },
    annotations: {
      'openchoreo.dev/display-name': 'My Resource',
      'openchoreo.dev/description': 'A test resource',
      'custom/note': 'extra',
    },
  },
  status: {
    conditions: [
      {
        type: 'Ready',
        status: 'True' as const,
        lastTransitionTime: '2025-01-06T10:00:05Z',
        reason: 'Reconciled',
        message: 'Resource is ready',
      },
      {
        type: 'Available',
        status: 'True' as const,
        lastTransitionTime: '2025-01-06T10:00:03Z',
        reason: 'Running',
        message: 'Available',
      },
    ],
  },
};

const emptyResource = {};
const metadataOnlyResource = { metadata: {} as any };

// ---------------------------------------------------------------------------
// Metadata accessors
// ---------------------------------------------------------------------------

describe('getName', () => {
  it('returns the resource name', () => {
    expect(getName(fullResource)).toBe('my-resource');
  });

  it('returns undefined for empty resource', () => {
    expect(getName(emptyResource)).toBeUndefined();
  });

  it('returns undefined when metadata has no name', () => {
    expect(getName(metadataOnlyResource)).toBeUndefined();
  });
});

describe('getNamespace', () => {
  it('returns the namespace', () => {
    expect(getNamespace(fullResource)).toBe('my-ns');
  });

  it('returns undefined for empty resource', () => {
    expect(getNamespace(emptyResource)).toBeUndefined();
  });
});

describe('getUid', () => {
  it('returns the uid', () => {
    expect(getUid(fullResource)).toBe('550e8400-e29b-41d4-a716-446655440000');
  });

  it('returns undefined for empty resource', () => {
    expect(getUid(emptyResource)).toBeUndefined();
  });
});

describe('getCreatedAt', () => {
  it('returns the creationTimestamp', () => {
    expect(getCreatedAt(fullResource)).toBe('2025-01-06T10:00:00Z');
  });

  it('returns undefined for empty resource', () => {
    expect(getCreatedAt(emptyResource)).toBeUndefined();
  });
});

describe('getLabels', () => {
  it('returns the labels map', () => {
    expect(getLabels(fullResource)).toEqual({ app: 'backend', tier: 'api' });
  });

  it('returns undefined for empty resource', () => {
    expect(getLabels(emptyResource)).toBeUndefined();
  });
});

describe('getAnnotations', () => {
  it('returns the annotations map', () => {
    expect(getAnnotations(fullResource)).toEqual({
      'openchoreo.dev/display-name': 'My Resource',
      'openchoreo.dev/description': 'A test resource',
      'custom/note': 'extra',
    });
  });

  it('returns undefined for empty resource', () => {
    expect(getAnnotations(emptyResource)).toBeUndefined();
  });
});

describe('getLabel', () => {
  it('returns a specific label value', () => {
    expect(getLabel(fullResource, 'app')).toBe('backend');
  });

  it('returns undefined for missing label', () => {
    expect(getLabel(fullResource, 'nonexistent')).toBeUndefined();
  });

  it('returns undefined for empty resource', () => {
    expect(getLabel(emptyResource, 'app')).toBeUndefined();
  });
});

describe('getAnnotation', () => {
  it('returns a specific annotation value', () => {
    expect(getAnnotation(fullResource, 'custom/note')).toBe('extra');
  });

  it('returns undefined for missing annotation', () => {
    expect(getAnnotation(fullResource, 'nonexistent')).toBeUndefined();
  });

  it('returns undefined for empty resource', () => {
    expect(getAnnotation(emptyResource, 'custom/note')).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Display helpers
// ---------------------------------------------------------------------------

describe('getDisplayName', () => {
  it('returns display-name annotation', () => {
    expect(getDisplayName(fullResource)).toBe('My Resource');
  });

  it('returns empty string when annotation is missing', () => {
    const noAnnotations = {
      metadata: { name: 'fallback-name' },
    };
    expect(getDisplayName(noAnnotations)).toBe('');
  });

  it('returns empty string for empty resource', () => {
    expect(getDisplayName(emptyResource)).toBe('');
  });
});

describe('getDescription', () => {
  it('returns description annotation', () => {
    expect(getDescription(fullResource)).toBe('A test resource');
  });

  it('returns undefined when annotation is missing', () => {
    const noAnnotations = { metadata: { name: 'test' } };
    expect(getDescription(noAnnotations)).toBeUndefined();
  });

  it('returns undefined for empty resource', () => {
    expect(getDescription(emptyResource)).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Condition helpers
// ---------------------------------------------------------------------------

describe('getConditions', () => {
  it('returns conditions array', () => {
    const conditions = getConditions(fullResource);
    expect(conditions).toHaveLength(2);
    expect(conditions![0].type).toBe('Ready');
    expect(conditions![1].type).toBe('Available');
  });

  it('returns undefined for empty resource', () => {
    expect(getConditions(emptyResource)).toBeUndefined();
  });

  it('returns undefined when status has no conditions', () => {
    expect(getConditions({ status: {} })).toBeUndefined();
  });
});

describe('getCondition', () => {
  it('returns the matching condition', () => {
    const condition = getCondition(fullResource, 'Ready');
    expect(condition).toBeDefined();
    expect(condition!.status).toBe('True');
    expect(condition!.reason).toBe('Reconciled');
  });

  it('returns undefined for non-existent condition type', () => {
    expect(getCondition(fullResource, 'NonExistent')).toBeUndefined();
  });

  it('returns undefined for empty resource', () => {
    expect(getCondition(emptyResource, 'Ready')).toBeUndefined();
  });
});

describe('getConditionStatus', () => {
  it('returns True for ready condition', () => {
    expect(getConditionStatus(fullResource, 'Ready')).toBe('True');
  });

  it('returns False for a false condition', () => {
    const notReadyResource = {
      status: {
        conditions: [
          {
            type: 'Ready',
            status: 'False' as const,
            lastTransitionTime: '2025-01-06T10:00:05Z',
            reason: 'Error',
            message: 'Failed',
          },
        ],
      },
    };
    expect(getConditionStatus(notReadyResource, 'Ready')).toBe('False');
  });

  it('returns Unknown for an unknown condition', () => {
    const unknownResource = {
      status: {
        conditions: [
          {
            type: 'Ready',
            status: 'Unknown' as const,
            lastTransitionTime: '2025-01-06T10:00:05Z',
            reason: 'Pending',
            message: 'Waiting',
          },
        ],
      },
    };
    expect(getConditionStatus(unknownResource, 'Ready')).toBe('Unknown');
  });

  it('returns undefined for missing condition type', () => {
    expect(getConditionStatus(fullResource, 'NonExistent')).toBeUndefined();
  });

  it('returns undefined for empty resource', () => {
    expect(getConditionStatus(emptyResource, 'Ready')).toBeUndefined();
  });
});

describe('isReady', () => {
  it('returns true when Ready condition is True', () => {
    expect(isReady(fullResource)).toBe(true);
  });

  it('returns false when Ready condition is False', () => {
    const notReady = {
      status: {
        conditions: [
          {
            type: 'Ready',
            status: 'False' as const,
            lastTransitionTime: '2025-01-06T10:00:05Z',
            reason: 'Error',
            message: 'Failed',
          },
        ],
      },
    };
    expect(isReady(notReady)).toBe(false);
  });

  it('returns false when Ready condition is Unknown', () => {
    const unknown = {
      status: {
        conditions: [
          {
            type: 'Ready',
            status: 'Unknown' as const,
            lastTransitionTime: '2025-01-06T10:00:05Z',
            reason: 'Pending',
            message: 'Waiting',
          },
        ],
      },
    };
    expect(isReady(unknown)).toBe(false);
  });

  it('returns false when no conditions exist', () => {
    expect(isReady(emptyResource)).toBe(false);
  });

  it('returns false when conditions array is empty', () => {
    expect(isReady({ status: { conditions: [] } })).toBe(false);
  });

  it('returns false when status has no conditions key', () => {
    expect(isReady({ status: {} })).toBe(false);
  });
});
