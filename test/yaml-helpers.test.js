'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const {
  looksLikeFilePath,
  getNestedFlow,
  getParallelBranches,
  getLoopItemVar,
  walkFlow,
  walkAllFlows,
  MAX_WALK_DEPTH,
} = require('../src/utils/yaml-helpers');

describe('yaml-helpers', () => {
  // -------------------------------------------------------------------------
  // looksLikeFilePath
  // -------------------------------------------------------------------------
  describe('looksLikeFilePath', () => {
    it('returns true for .yaml extension', () => {
      assert.equal(looksLikeFilePath('test.yaml'), true);
    });

    it('returns true for .yml extension', () => {
      assert.equal(looksLikeFilePath('test.yml'), true);
    });

    it('returns true for paths with directories', () => {
      assert.equal(looksLikeFilePath('path/to/file.yaml'), true);
    });

    it('returns false for strings with newlines', () => {
      assert.equal(looksLikeFilePath('web:\n  url: "test"'), false);
    });

    it('returns false for non-yaml extensions', () => {
      assert.equal(looksLikeFilePath('file.json'), false);
      assert.equal(looksLikeFilePath('file.txt'), false);
    });

    it('is case-insensitive for extension', () => {
      assert.equal(looksLikeFilePath('test.YAML'), true);
      assert.equal(looksLikeFilePath('test.YML'), true);
    });
  });

  // -------------------------------------------------------------------------
  // getNestedFlow
  // -------------------------------------------------------------------------
  describe('getNestedFlow', () => {
    it('returns flow array when present', () => {
      const container = { flow: [{ aiTap: 'button' }] };
      assert.deepEqual(getNestedFlow(container), [{ aiTap: 'button' }]);
    });

    it('returns steps array as alias', () => {
      const container = { steps: [{ aiTap: 'button' }] };
      assert.deepEqual(getNestedFlow(container), [{ aiTap: 'button' }]);
    });

    it('prefers flow over steps', () => {
      const container = { flow: [{ aiTap: 'a' }], steps: [{ aiTap: 'b' }] };
      assert.deepEqual(getNestedFlow(container), [{ aiTap: 'a' }]);
    });

    it('returns undefined for null input', () => {
      assert.equal(getNestedFlow(null), undefined);
    });

    it('returns undefined for non-object', () => {
      assert.equal(getNestedFlow('string'), undefined);
    });

    it('returns undefined when no flow or steps', () => {
      assert.equal(getNestedFlow({}), undefined);
    });
  });

  // -------------------------------------------------------------------------
  // getParallelBranches
  // -------------------------------------------------------------------------
  describe('getParallelBranches', () => {
    it('returns tasks array', () => {
      const parallel = { tasks: [{ flow: [] }] };
      assert.deepEqual(getParallelBranches(parallel), [{ flow: [] }]);
    });

    it('returns branches array as alias', () => {
      const parallel = { branches: [{ flow: [] }] };
      assert.deepEqual(getParallelBranches(parallel), [{ flow: [] }]);
    });

    it('returns undefined for null', () => {
      assert.equal(getParallelBranches(null), undefined);
    });

    it('returns undefined for non-object', () => {
      assert.equal(getParallelBranches(42), undefined);
    });
  });

  // -------------------------------------------------------------------------
  // getLoopItemVar
  // -------------------------------------------------------------------------
  describe('getLoopItemVar', () => {
    it('returns itemVar when present', () => {
      assert.equal(getLoopItemVar({ itemVar: 'user' }), 'user');
    });

    it('returns as when present', () => {
      assert.equal(getLoopItemVar({ as: 'record' }), 'record');
    });

    it('returns item when present', () => {
      assert.equal(getLoopItemVar({ item: 'entry' }), 'entry');
    });

    it('prefers itemVar over as and item', () => {
      assert.equal(getLoopItemVar({ itemVar: 'a', as: 'b', item: 'c' }), 'a');
    });

    it('defaults to item for empty object', () => {
      assert.equal(getLoopItemVar({}), 'item');
    });

    it('defaults to item for null', () => {
      assert.equal(getLoopItemVar(null), 'item');
    });
  });

  // -------------------------------------------------------------------------
  // walkFlow
  // -------------------------------------------------------------------------
  describe('walkFlow', () => {
    it('visits each step in a flat flow', () => {
      const flow = [{ aiTap: 'a' }, { aiTap: 'b' }];
      const visited = [];
      walkFlow(flow, '/flow', (step) => visited.push(step.aiTap));
      assert.deepEqual(visited, ['a', 'b']);
    });

    it('recurses into logic branches', () => {
      const flow = [
        { logic: { if: 'true', then: [{ aiTap: 'then' }], else: [{ aiTap: 'else' }] } },
      ];
      const visited = [];
      walkFlow(flow, '/flow', (step) => {
        if (step.aiTap) visited.push(step.aiTap);
      });
      assert.deepEqual(visited, ['then', 'else']);
    });

    it('recurses into loop body', () => {
      const flow = [
        { loop: { type: 'repeat', count: 3, flow: [{ aiTap: 'inner' }] } },
      ];
      const visited = [];
      walkFlow(flow, '/flow', (step) => {
        if (step.aiTap) visited.push(step.aiTap);
      });
      assert.deepEqual(visited, ['inner']);
    });

    it('recurses into try/catch/finally', () => {
      const flow = [
        {
          try: { flow: [{ aiTap: 'try' }] },
          catch: { flow: [{ aiTap: 'catch' }] },
          finally: { flow: [{ aiTap: 'finally' }] },
        },
      ];
      const visited = [];
      walkFlow(flow, '/flow', (step) => {
        if (step.aiTap) visited.push(step.aiTap);
      });
      assert.deepEqual(visited, ['try', 'catch', 'finally']);
    });

    it('recurses into parallel branches', () => {
      const flow = [
        { parallel: { tasks: [{ flow: [{ aiTap: 'branch1' }] }, { flow: [{ aiTap: 'branch2' }] }] } },
      ];
      const visited = [];
      walkFlow(flow, '/flow', (step) => {
        if (step.aiTap) visited.push(step.aiTap);
      });
      assert.deepEqual(visited, ['branch1', 'branch2']);
    });

    it('skips recursion when visitor returns false', () => {
      const flow = [
        { logic: { if: 'true', then: [{ aiTap: 'hidden' }] } },
      ];
      const visited = [];
      walkFlow(flow, '/flow', (step) => {
        visited.push(Object.keys(step)[0]);
        return false; // skip recursion
      });
      assert.deepEqual(visited, ['logic']);
    });

    it('handles non-array input gracefully', () => {
      const visited = [];
      walkFlow(null, '/flow', () => visited.push('visited'));
      walkFlow('string', '/flow', () => visited.push('visited'));
      assert.deepEqual(visited, []);
    });

    it('skips null/non-object steps', () => {
      const flow = [null, 'string', 42, { aiTap: 'valid' }];
      const visited = [];
      walkFlow(flow, '/flow', (step) => visited.push(step.aiTap));
      assert.deepEqual(visited, ['valid']);
    });

    it('respects MAX_WALK_DEPTH', () => {
      assert.equal(typeof MAX_WALK_DEPTH, 'number');
      assert.ok(MAX_WALK_DEPTH > 0);
    });
  });

  // -------------------------------------------------------------------------
  // walkAllFlows
  // -------------------------------------------------------------------------
  describe('walkAllFlows', () => {
    it('walks flows from all tasks', () => {
      const doc = {
        tasks: [
          { name: 'task1', flow: [{ aiTap: 'a' }] },
          { name: 'task2', flow: [{ aiTap: 'b' }] },
        ],
      };
      const visited = [];
      walkAllFlows(doc, (step) => {
        if (step.aiTap) visited.push(step.aiTap);
      });
      assert.deepEqual(visited, ['a', 'b']);
    });

    it('handles missing tasks gracefully', () => {
      walkAllFlows(null, () => assert.fail('should not be called'));
      walkAllFlows({}, () => assert.fail('should not be called'));
      walkAllFlows({ tasks: 'invalid' }, () => assert.fail('should not be called'));
    });

    it('supports steps alias in tasks', () => {
      const doc = {
        tasks: [
          { name: 'task1', steps: [{ aiTap: 'c' }] },
        ],
      };
      const visited = [];
      walkAllFlows(doc, (step) => {
        if (step.aiTap) visited.push(step.aiTap);
      });
      assert.deepEqual(visited, ['c']);
    });
  });
});
