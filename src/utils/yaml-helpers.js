'use strict';

/**
 * yaml-helpers.js
 * Shared utilities for working with Midscene YAML Superset structures.
 * Centralises file-path detection, flow/steps alias resolution, and
 * generic recursive flow walking so that detector, validator, and
 * transpiler modules do not duplicate these concerns.
 */

const path = require('path');
const { MAX_WALK_DEPTH } = require('../constants');

// ---------------------------------------------------------------------------
// File-path detection
// ---------------------------------------------------------------------------

/**
 * Determine whether `input` looks like a file path rather than raw YAML
 * content. A string is treated as a path when it does not contain a newline
 * and ends with `.yaml` or `.yml`.
 *
 * @param {string} input
 * @returns {boolean}
 */
function looksLikeFilePath(input) {
  if (input.includes('\n')) {
    return false;
  }
  const ext = path.extname(input).toLowerCase();
  return ext === '.yaml' || ext === '.yml';
}

// ---------------------------------------------------------------------------
// Alias resolution helpers
// ---------------------------------------------------------------------------

/**
 * Resolve the `flow` / `steps` alias on a container object (loop body,
 * try block, catch block, finally block, parallel branch, etc.).
 *
 * @param {object} container - An object that may have a `flow` or `steps` key.
 * @returns {Array|undefined} The flow array, or undefined if neither key exists.
 */
function getNestedFlow(container) {
  if (!container || typeof container !== 'object') return undefined;
  return container.flow || container.steps;
}

/**
 * Resolve the `tasks` / `branches` alias on a `parallel` construct.
 *
 * @param {object} parallel - The parallel construct object.
 * @returns {Array|undefined} The branches array, or undefined if neither key exists.
 */
function getParallelBranches(parallel) {
  if (!parallel || typeof parallel !== 'object') return undefined;
  return parallel.tasks || parallel.branches;
}

/**
 * Resolve the loop item variable name from the various aliases
 * (`itemVar`, `as`, `item`) with a default of `'item'`.
 *
 * @param {object} loop - The loop construct object.
 * @returns {string} The item variable name.
 */
function getLoopItemVar(loop) {
  if (!loop || typeof loop !== 'object') return 'item';
  return loop.itemVar || loop.as || loop.item || 'item';
}

// ---------------------------------------------------------------------------
// Generic recursive flow walker
// ---------------------------------------------------------------------------

/**
 * Recursively walk a flow array, calling `visitor(step, path)` on every
 * step. Automatically recurses into nested constructs (logic, loop, try,
 * parallel) so callers do not need to implement their own recursion.
 *
 * The visitor may optionally return `false` to skip recursion into that
 * step's children (useful when the visitor handles children itself).
 *
 * @param {Array} flow      - The flow array to walk.
 * @param {string} pathPrefix - JSON-pointer-like prefix for diagnostics.
 * @param {function(object, string): boolean|void} visitor
 *   Called for each step with `(step, stepPath)`.  Return `false` to
 *   suppress automatic child recursion for that step.
 * @param {number} [_depth=0] - Internal recursion depth counter.
 */
function walkFlow(flow, pathPrefix, visitor, _depth) {
  _depth = _depth || 0;
  if (_depth >= MAX_WALK_DEPTH) {
    if (typeof visitor._onDepthLimit === 'function') {
      visitor._onDepthLimit(pathPrefix, MAX_WALK_DEPTH);
    }
    return;
  }
  if (!Array.isArray(flow)) return;

  for (let i = 0; i < flow.length; i++) {
    const step = flow[i];
    if (!step || typeof step !== 'object') continue;

    const stepPath = `${pathPrefix}[${i}]`;
    const shouldRecurse = visitor(step, stepPath);

    // If the visitor explicitly returns false, skip automatic recursion.
    if (shouldRecurse === false) continue;

    // --- Recurse into nested constructs ---

    // logic: then / else branches
    if (step.logic && typeof step.logic === 'object') {
      if (Array.isArray(step.logic.then)) {
        walkFlow(step.logic.then, `${stepPath}/logic/then`, visitor, _depth + 1);
      }
      if (Array.isArray(step.logic.else)) {
        walkFlow(step.logic.else, `${stepPath}/logic/else`, visitor, _depth + 1);
      }
    }

    // loop: flow / steps body
    if (step.loop && typeof step.loop === 'object') {
      const loopFlow = getNestedFlow(step.loop);
      if (Array.isArray(loopFlow)) {
        walkFlow(loopFlow, `${stepPath}/loop/flow`, visitor, _depth + 1);
      }
    }

    // try / catch / finally — catch and finally are siblings of try at the step level
    if (step.try && typeof step.try === 'object') {
      const tryFlow = getNestedFlow(step.try);
      if (Array.isArray(tryFlow)) {
        walkFlow(tryFlow, `${stepPath}/try/flow`, visitor, _depth + 1);
      }
    }
    if (step.catch && typeof step.catch === 'object') {
      const catchFlow = getNestedFlow(step.catch);
      if (Array.isArray(catchFlow)) {
        walkFlow(catchFlow, `${stepPath}/catch/flow`, visitor, _depth + 1);
      }
    }
    if (step.finally && typeof step.finally === 'object') {
      const finallyFlow = getNestedFlow(step.finally);
      if (Array.isArray(finallyFlow)) {
        walkFlow(finallyFlow, `${stepPath}/finally/flow`, visitor, _depth + 1);
      }
    }

    // parallel: tasks / branches
    if (step.parallel && typeof step.parallel === 'object') {
      const branches = getParallelBranches(step.parallel);
      if (Array.isArray(branches)) {
        for (let t = 0; t < branches.length; t++) {
          const branchFlow = branches[t] && getNestedFlow(branches[t]);
          if (Array.isArray(branchFlow)) {
            walkFlow(branchFlow, `${stepPath}/parallel/tasks[${t}]/flow`, visitor, _depth + 1);
          }
        }
      }
    }
  }
}

/**
 * Walk every flow in every task of a parsed YAML document.
 * A convenience wrapper around walkFlow() that handles the top-level
 * `tasks` array iteration.
 *
 * @param {object} doc - Parsed YAML document.
 * @param {function(object, string): boolean|void} visitor
 */
function walkAllFlows(doc, visitor) {
  if (!doc || !doc.tasks || !Array.isArray(doc.tasks)) return;

  doc.tasks.forEach(function (task, taskIndex) {
    const flow = getNestedFlow(task);
    if (!task || !Array.isArray(flow)) return;
    walkFlow(flow, '/tasks[' + taskIndex + ']/flow', visitor);
  });
}

module.exports = {
  looksLikeFilePath,
  getNestedFlow,
  getParallelBranches,
  getLoopItemVar,
  walkFlow,
  walkAllFlows,
  MAX_WALK_DEPTH,
};
