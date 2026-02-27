'use strict';

/**
 * data-transform-gen.js
 * Converts `data_transform` blocks from YAML into TypeScript data manipulation code.
 * Supports operations: filter, sort, map, reduce, slice, unique, flatten, groupBy.
 */

/**
 * Resolve YAML ${var} template syntax into JS template literals.
 * ${ENV.XXX} is converted to process.env.XXX.
 */
function resolveTemplate(str) {
  if (typeof str !== 'string') return str;
  if (!str.includes('${')) return str;

  let result = str.replace(/\$\{ENV\.(\w+)\}/g, '${process.env.$1}');

  const singleExprMatch = result.match(/^\$\{([^}]+)\}$/);
  if (singleExprMatch) {
    return { __expr: singleExprMatch[1] };
  }

  return { __template: '`' + result + '`' };
}

/**
 * Extract a raw variable reference from a template string like "${items}".
 */
function extractVarRef(str) {
  if (typeof str !== 'string') return null;
  const match = str.match(/^\$\{([a-zA-Z_$][a-zA-Z0-9_$.]*)\}$/);
  return match ? match[1] : null;
}

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
 * Resolve ${var} references within an operation expression string.
 * Replaces ${varName} with just varName so it becomes a JS variable reference.
 * Replaces ${ENV.XXX} with process.env.XXX.
 */
function resolveExprVars(expr) {
  if (typeof expr !== 'string') return expr;
  return expr
    .replace(/\$\{ENV\.(\w+)\}/g, 'process.env.$1')
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

  // Sort operation
  if (op.sort !== undefined) {
    const { field, order } = parseSortExpr(op.sort);
    if (order === 'desc') {
      return pad + outputVar + ' = ' + outputVar + '.sort((a, b) => b.' + field + ' - a.' + field + ');';
    }
    return pad + outputVar + ' = ' + outputVar + '.sort((a, b) => a.' + field + ' - b.' + field + ');';
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
function generate(step, ctx) {
  const indent = ctx && ctx.indent || 0;
  const pad = '  '.repeat(indent);
  const varScope = ctx && ctx.varScope || new Set();
  const transform = step.data_transform;

  if (!transform) {
    return pad + '// Invalid data_transform: missing definition';
  }

  const lines = [];

  // Resolve input variable
  const inputRef = extractVarRef(transform.input) || transform.input;
  const outputVar = transform.output || 'transformedData';

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
