import { ComponentTypeUtils } from './componentTypeUtils';

describe('ComponentTypeUtils', () => {
  const utils = ComponentTypeUtils.createDefault();

  describe('getPageVariant', () => {
    it('returns "service" for deployment services', () => {
      expect(utils.getPageVariant('deployment/service')).toBe('service');
      expect(utils.getPageVariant('deployment/go-service')).toBe('service');
      expect(utils.getPageVariant('deployment/my-api')).toBe('service');
    });

    it('returns "service" for statefulset types', () => {
      expect(utils.getPageVariant('statefulset/database')).toBe('service');
    });

    it('returns "website" for web application types', () => {
      expect(utils.getPageVariant('deployment/web-app')).toBe('website');
      expect(utils.getPageVariant('deployment/webapp')).toBe('website');
      expect(utils.getPageVariant('deployment/web-application')).toBe(
        'website',
      );
      expect(utils.getPageVariant('deployment/react-frontend')).toBe('website');
    });

    it('returns "scheduled-task" for cronjob and job types', () => {
      expect(utils.getPageVariant('cronjob/cleanup')).toBe('scheduled-task');
      expect(utils.getPageVariant('job/migration')).toBe('scheduled-task');
    });

    it('returns "default" for unknown types', () => {
      expect(utils.getPageVariant('unknown/something')).toBe('default');
      expect(utils.getPageVariant('')).toBe('default');
    });

    it('website patterns take precedence over generic deployment', () => {
      // "deployment/web-app-service" should match website (web-app) before generic deployment
      expect(utils.getPageVariant('deployment/web-app-service')).toBe(
        'website',
      );
    });
  });

  describe('parseComponentType', () => {
    it('parses standard component types', () => {
      expect(utils.parseComponentType('deployment/service')).toEqual({
        workloadType: 'deployment',
        typeName: 'service',
      });
    });

    it('parses cronjob types', () => {
      expect(utils.parseComponentType('cronjob/cleanup-job')).toEqual({
        workloadType: 'cronjob',
        typeName: 'cleanup-job',
      });
    });

    it('parses statefulset types', () => {
      expect(utils.parseComponentType('statefulset/postgres')).toEqual({
        workloadType: 'statefulset',
        typeName: 'postgres',
      });
    });

    it('returns unknown for unrecognized format', () => {
      expect(utils.parseComponentType('invalid')).toEqual({
        workloadType: 'unknown',
        typeName: 'invalid',
      });
    });

    it('returns unknown for unsupported workload type prefix', () => {
      expect(utils.parseComponentType('daemonset/agent')).toEqual({
        workloadType: 'unknown',
        typeName: 'daemonset/agent',
      });
    });
  });

  describe('generateTags', () => {
    it('generates standard tags', () => {
      const tags = utils.generateTags('deployment/service');
      expect(tags).toContain('openchoreo');
      expect(tags).toContain('component');
      expect(tags).toContain('deployment-service');
    });

    it('replaces slash with dash in type tag', () => {
      const tags = utils.generateTags('cronjob/cleanup');
      expect(tags).toContain('cronjob-cleanup');
    });
  });
});
