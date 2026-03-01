'use strict';

/**
 * data-transform-gen.js
 * Converts `data_transform` blocks from YAML into TypeScript data manipulation code.
 * Supports operations: filter, sort, map, reduce, slice, unique, flatten, groupBy.
 */

const { extractVarRef, resolveEnvRefs, getPad } = require('./utils');

/**
 * Parse a sort expression like "price desc" or "name asc".
 * Returns { field, order }.
 */
function parseSortExpr(expr) {
  const parts = expr.trim().split(/\s+/);
  const field = parts[0];
  const order = (parts[1] || 'asc').toLowerCase();
  return { field, order };
}

/**
 * Generate a sort assignment statement. Handles both string and numeric
 * fields with ascending/descending order.
 *
 * @param {string} field     - The property name to sort by.
 * @param {string} order     - 'asc' or 'desc'.
 * @param {string} outputVar - The variable holding the array.
 * @param {string} pad       - Indentation string.
 * @returns {string} A complete sort assignment statement.
 */
function generateSortCode(field, order, outputVar, pad) {
  const cmp = "typeof a." + field + " === 'string' ? a." + field + ".localeCompare(b." + field + ") : a." + field + " - b." + field;
  if (order === 'desc') {
    return pad + outputVar + ' = ' + outputVar + ".sort((a, b) => { const c = " + cmp + "; return -c; });";
  }
  return pad + outputVar + ' = ' + outputVar + ".sort((a, b) => " + cmp + ");";
}

/**
 * Resolve ${var} references within an operation expression string.
 * Replaces ${varName} with just varName so it becomes a JS variable reference.
 * Delegates ENV resolution to the shared resolveEnvRefs helper.
 */
function resolveExprVars(expr) {
  if (typeof expr !== 'string') return expr;
  return resolveEnvRefs(expr)
    .replace(/\$\{([^}]+)\}/g, '$1');
}

/**
 * Generate a single operation's TypeScript code.
 */
function generateOperation(op, outputVar, pad) {
  if (typeof op === 'string') {
    // Simple string operation, try to parse it
    return pad + outputVar + ' = ' + outputVar + '.' + resolveExprVars(op) + ';';
  }

  if (typeof op !== 'object') {
    return pad + '// Unknown operation: ' + JSON.stringify(op);
  }

  // Filter operation
  if (op.filter !== undefined) {
    const filterExpr = resolveExprVars(op.filter);
    return pad + outputVar + ' = ' + outputVar + '.filter(item => item.' + filterExpr + ');';
  }

  // Sort operation (works for both numeric and string fields)
  if (op.sort !== undefined) {
    const { field, order } = parseSortExpr(op.sort);
    return generateSortCode(field, order, outputVar, pad);
  }

  // Map operation
  if (op.map !== undefined) {
    const mapExpr = resolveExprVars(op.map);
    return pad + outputVar + ' = ' + outputVar + '.map(item => (' + mapExpr + '));';
  }

  // Reduce operation
  if (op.reduce !== undefined) {
    const reduceExpr = resolveExprVars(op.reduce);
    const initial = op.initial !== undefined ? JSON.stringify(op.initial) : '0';
    return pad + outputVar + ' = ' + outputVar + '.reduce((acc, item) => ' + reduceExpr + ', ' + initial + ');';
  }

  // Slice operation
  if (op.slice !== undefined) {
    const start = op.slice.start || 0;
    const end = op.slice.end;
    if (end !== undefined) {
      return pad + outputVar + ' = ' + outputVar + '.slice(' + start + ', ' + end + ');';
    }
    return pad + outputVar + ' = ' + outputVar + '.slice(' + start + ');';
  }

  // Unique / distinct operation
  if (op.unique !== undefined || op.distinct !== undefined) {
    const field = op.unique || op.distinct;
    if (field && typeof field === 'string') {
      return pad + outputVar + ' = [...new Map(' + outputVar + '.map(item => [item.' + field + ', item])).values()];';
    }
    return pad + outputVar + ' = [...new Set(' + outputVar + ')];';
  }

  // Flatten operation
  if (op.flatten !== undefined) {
    const depth = typeof op.flatten === 'number' ? op.flatten : 1;
    return pad + outputVar + ' = ' + outputVar + '.flat(' + depth + ');';
  }

  // GroupBy operation
  if (op.groupBy !== undefined) {
    const field = op.groupBy;
    return pad + outputVar + ' = ' + outputVar + '.reduce((groups, item) => { const key = item.' + field + '; (groups[key] = groups[key] || []).push(item); return groups; }, {});';
  }

  return pad + '// Unknown operation: ' + JSON.stringify(op);
}

/**
 * Generate TypeScript code for a `data_transform` step.
 *
 * @param {object} step - The YAML step: { data_transform: { input, operations, output } }
 * @param {object} ctx  - Context: { indent: number, varScope: Set<string> }
 * @returns {string} TypeScript code string.
 */
/**
 * Generate code for the Guide's flat data_transform format:
 *   data_transform:
 *     source: "${rawProducts}"
 *     operation: filter
 *     condition: "item.rating >= 4"
 *     name: "highRatedProducts"
 */
function generateFlatTransform(transform, pad, varScope) {
  const lines = [];
  const inputRef = extractVarRef(transform.source) || resolveExprVars(transform.source || '[]');
  const outputVar = transform.name || 'transformedData';
  const operation = transform.operation;

  // Declare output variable
  if (varScope.has(outputVar)) {
    lines.push(pad + outputVar + ' = [...' + inputRef + '];');
  } else {
    varScope.add(outputVar);
    lines.push(pad + 'let ' + outputVar + ' = [...' + inputRef + '];');
  }

  if (operation === 'filter') {
    const condition = resolveExprVars(transform.condition || 'true');
    lines.push(pad + outputVar + ' = ' + outputVar + '.filter(item => ' + condition + ');');
  } else if (operation === 'sort') {
    const field = transform.by || 'id';
    const order = (transform.order || 'asc').toLowerCase();
    lines.push(generateSortCode(field, order, outputVar, pad));
  } else if (operation === 'map') {
    if (transform.template && typeof transform.template === 'object') {
      const entries = Object.entries(transform.template).map(([k, v]) => {
        const val = extractVarRef(v);
        if (val) {
          // ${item.name} → item.name
          return k + ': ' + val;
        }
        return k + ': ' + resolveExprVars(JSON.stringify(v));
      });
      lines.push(pad + outputVar + ' = ' + outputVar + '.map(item => ({ ' + entries.join(', ') + ' }));');
    } else {
      const mapExpr = resolveExprVars(transform.template || 'item');
      lines.push(pad + outputVar + ' = ' + outputVar + '.map(item => (' + mapExpr + '));');
    }
  } else if (operation === 'reduce') {
    const reducer = resolveExprVars(transform.reducer || 'acc + item');
    const initial = transform.initial !== undefined ? JSON.stringify(transform.initial) : '0';
    lines.push(pad + outputVar + ' = ' + outputVar + '.reduce((acc, item) => ' + reducer + ', ' + initial + ');');
  } else if (operation === 'unique') {
    const byField = transform.by;
    if (byField && typeof byField === 'string') {
      lines.push(pad + outputVar + ' = [...new Map(' + outputVar + '.map(item => [item.' + byField + ', item])).values()];');
    } else {
      lines.push(pad + outputVar + ' = [...new Set(' + outputVar + ')];');
    }
  } else if (operation === 'slice') {
    const start = transform.start || 0;
    const end = transform.end;
    if (end !== undefined) {
      lines.push(pad + outputVar + ' = ' + outputVar + '.slice(' + start + ', ' + end + ');');
    } else {
      lines.push(pad + outputVar + ' = ' + outputVar + '.slice(' + start + ');');
    }
  } else if (operation === 'flatten') {
    const depth = typeof transform.depth === 'number' ? transform.depth : 1;
    lines.push(pad + outputVar + ' = ' + outputVar + '.flat(' + depth + ');');
  } else if (operation === 'groupBy') {
    const field = transform.by || transform.field || 'id';
    lines.push(pad + outputVar + ' = ' + outputVar + '.reduce((groups, item) => { const key = item.' + field + '; (groups[key] = groups[key] || []).push(item); return groups; }, {});');
  } else {
    lines.push(pad + '// Unknown operation: ' + operation);
  }

  return lines.join('\n');
}

function generate(step, ctx) {
  const indent = ctx && ctx.indent || 0;
  const pad = getPad(indent);
  const varScope = ctx && ctx.varScope || new Set();
  const transform = step.data_transform;

  if (!transform) {
    return pad + '// Invalid data_transform: missing definition';
  }

  // Support the Guide's flat format: { source, operation, condition, name }
  if (transform.operation || transform.source) {
    return generateFlatTransform(transform, pad, varScope);
  }

  // Nested format: { input, operations: [...], output }
  const lines = [];

  // Resolve input variable
  const inputRef = extractVarRef(transform.input) || transform.input || '[]';
  const outputVar = transform.output || transform.name || 'transformedData';

  // Declare output variable initialized from input
  if (varScope.has(outputVar)) {
    lines.push(pad + outputVar + ' = ' + inputRef + ';');
  } else {
    varScope.add(outputVar);
    lines.push(pad + 'let ' + outputVar + ' = ' + inputRef + ';');
  }

  // Apply each operation in sequence
  const operations = transform.operations || [];
  for (const op of operations) {
    lines.push(generateOperation(op, outputVar, pad));
  }

  return lines.join('\n');
}

module.exports = { generate };
