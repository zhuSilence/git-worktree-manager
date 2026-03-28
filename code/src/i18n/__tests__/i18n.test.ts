import { describe, it, expect } from 'vitest';
import zhCN from '@/i18n/locales/zh-CN.json';
import enUS from '@/i18n/locales/en-US.json';

function getNestedKeys(obj: Record<string, unknown>, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([key, value]) => {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'object' && value !== null) {
      return getNestedKeys(value as Record<string, unknown>, fullKey);
    }
    return [fullKey];
  });
}

function getNestedStructure(obj: Record<string, unknown>): Record<string, string[] | Record<string, unknown>> {
  const result: Record<string, string[] | Record<string, unknown>> = {};

  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      result[key] = getNestedStructure(value as Record<string, unknown>);
    } else {
      if (!result._leafKeys) {
        result._leafKeys = [];
      }
      (result._leafKeys as string[]).push(key);
    }
  }

  return result;
}

describe('i18n translations', () => {
  describe('key consistency', () => {
    it('should have same keys in both languages', () => {
      const zhKeys = getNestedKeys(zhCN).sort();
      const enKeys = getNestedKeys(enUS).sort();
      expect(zhKeys).toEqual(enKeys);
    });

    it('should have same nested structure in both languages', () => {
      const zhStructure = getNestedStructure(zhCN);
      const enStructure = getNestedStructure(enUS);
      expect(JSON.stringify(zhStructure)).toBe(JSON.stringify(enStructure));
    });
  });

  describe('translation values', () => {
    it('should not have empty translation values in zh-CN', () => {
      const checkEmpty = (obj: Record<string, unknown>, path = '') => {
        Object.entries(obj).forEach(([key, value]) => {
          const fullPath = path ? `${path}.${key}` : key;
          if (typeof value === 'string') {
            expect(value.trim(), `Empty value at ${fullPath}`).not.toBe('');
          } else if (typeof value === 'object' && value !== null) {
            checkEmpty(value as Record<string, unknown>, fullPath);
          }
        });
      };
      checkEmpty(zhCN);
    });

    it('should not have empty translation values in en-US', () => {
      const checkEmpty = (obj: Record<string, unknown>, path = '') => {
        Object.entries(obj).forEach(([key, value]) => {
          const fullPath = path ? `${path}.${key}` : key;
          if (typeof value === 'string') {
            expect(value.trim(), `Empty value at ${fullPath}`).not.toBe('');
          } else if (typeof value === 'object' && value !== null) {
            checkEmpty(value as Record<string, unknown>, fullPath);
          }
        });
      };
      checkEmpty(enUS);
    });

    it('should have valid template placeholders in zh-CN', () => {
      const checkPlaceholders = (obj: Record<string, unknown>, path = '') => {
        Object.entries(obj).forEach(([key, value]) => {
          const fullPath = path ? `${path}.${key}` : key;
          if (typeof value === 'string') {
            // Check for valid i18next placeholders like {{count}}, {{name}}
            const placeholders = value.match(/\{\{[^}]+\}\}/g) || [];
            placeholders.forEach((p) => {
              expect(p, `Invalid placeholder ${p} at ${fullPath}`).toMatch(/^\{\{[\w]+\}\}$/);
            });
          } else if (typeof value === 'object' && value !== null) {
            checkPlaceholders(value as Record<string, unknown>, fullPath);
          }
        });
      };
      checkPlaceholders(zhCN);
    });

    it('should have valid template placeholders in en-US', () => {
      const checkPlaceholders = (obj: Record<string, unknown>, path = '') => {
        Object.entries(obj).forEach(([key, value]) => {
          const fullPath = path ? `${path}.${key}` : key;
          if (typeof value === 'string') {
            const placeholders = value.match(/\{\{[^}]+\}\}/g) || [];
            placeholders.forEach((p) => {
              expect(p, `Invalid placeholder ${p} at ${fullPath}`).toMatch(/^\{\{[\w]+\}\}$/);
            });
          } else if (typeof value === 'object' && value !== null) {
            checkPlaceholders(value as Record<string, unknown>, fullPath);
          }
        });
      };
      checkPlaceholders(enUS);
    });

    it('should have matching placeholders between languages', () => {
      const zhPlaceholders = new Map<string, string[]>();
      const enPlaceholders = new Map<string, string[]>();

      const collectPlaceholders = (
        obj: Record<string, unknown>,
        path: string,
        map: Map<string, string[]>
      ) => {
        Object.entries(obj).forEach(([key, value]) => {
          const fullPath = path ? `${path}.${key}` : key;
          if (typeof value === 'string') {
            const placeholders = (value.match(/\{\{[^}]+\}\}/g) || []).sort();
            if (placeholders.length > 0) {
              map.set(fullPath, placeholders);
            }
          } else if (typeof value === 'object' && value !== null) {
            collectPlaceholders(value as Record<string, unknown>, fullPath, map);
          }
        });
      };

      collectPlaceholders(zhCN, '', zhPlaceholders);
      collectPlaceholders(enUS, '', enPlaceholders);

      // Check that keys with placeholders have matching placeholders
      zhPlaceholders.forEach((placeholders, key) => {
        const enValue = enPlaceholders.get(key);
        expect(enValue, `Missing placeholders for key ${key} in en-US`).toBeDefined();
        expect(enValue, `Mismatched placeholders for key ${key}`).toEqual(placeholders);
      });

      enPlaceholders.forEach((placeholders, key) => {
        const zhValue = zhPlaceholders.get(key);
        expect(zhValue, `Missing placeholders for key ${key} in zh-CN`).toBeDefined();
      });
    });
  });

  describe('required keys', () => {
    it('should have common translation keys', () => {
      const requiredKeys = [
        'common.cancel',
        'common.save',
        'common.delete',
        'common.confirm',
        'common.loading',
        'common.error',
        'app.welcome',
        'settings.title',
        'worktree.title',
        'worktree.create',
        'worktree.delete',
      ];

      const allKeys = getNestedKeys(zhCN);
      requiredKeys.forEach((key) => {
        expect(allKeys, `Missing required key: ${key}`).toContain(key);
      });
    });

    it('should have status keys', () => {
      const statusKeys = ['clean', 'dirty', 'conflicted', 'detached', 'unknown'];
      statusKeys.forEach((key) => {
        expect(zhCN.status, `Missing status.${key}`).toHaveProperty(key);
        expect(enUS.status, `Missing status.${key}`).toHaveProperty(key);
      });
    });
  });
});
