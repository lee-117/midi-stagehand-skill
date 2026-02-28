'use strict';

const yaml = require('js-yaml');
const fs = require('fs');
const path = require('path');

const { detect } = require('../detector/mode-detector');

// Load keyword schemas once at module load time.
const nativeKeywords = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '../../schema/native-keywords.json'), 'utf8')
);
const extendedKeywords = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '../../schema/extended-keywords.json'), 'utf8')
);

// Build lookup sets from the schemas.
const NATIVE_KEYWORD_SET = new Set(nativeKeywords.allKeywords);
const EXTENDED_KEYWORD_SET = new Set(extendedKeywords.allExtendedKeywords);

// Top-level extended feature keywords (the primary keys that trigger extended mode).
const EXTENDED_FEATURE_KEYS = new Set(
  Object.keys(extendedKeywords.features).reduce((acc, feature) => {
    // Only the first keyword in each feature is the "top-level" trigger keyword.
    acc.push(extendedKeywords.features[feature].keywords[0]);
    return acc;
  }, [])
);

// Valid platform config keys at root level.
const PLATFORM_KEYS = new Set(['web', 'android', 'ios', 'computer']);

// Valid loop types.
const LOOP_TYPES = new Set(['for', 'while', 'repeat']);

// Required fields per loop type.
const LOOP_REQUIRED_FIELDS = {
  for: ['items'],
  while: ['condition'],
  repeat: ['count'],
};

// Regex for template variable references: ${varName} or ${varName.prop}
const TEMPLATE_VAR_REGEX = /\$\{([^}]+)\}/g;

// ---------------------------------------------------------------------------
// Internal helpers
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

/**
 * Read YAML content - either from a file path or treat the input as a raw
 * YAML string.
 *
 * @param {string} yamlInput - File path or raw YAML string.
 * @returns {{ content: string, filePath: string | null }}
 */
function resolveContent(yamlInput) {
  if (looksLikeFilePath(yamlInput)) {
    const resolved = path.resolve(yamlInput);
    return {
      content: fs.readFileSync(resolved, 'utf8'),
      filePath: resolved,
    };
  }
  return { content: yamlInput, filePath: null };
}

/**
 * Create an error entry.
 */
function makeError(message, yamlPath) {
  return { level: 'error', message, path: yamlPath || '' };
}

/**
 * Create a warning entry.
 */
function makeWarning(message, yamlPath) {
  return { level: 'warning', message, path: yamlPath || '' };
}

// ---------------------------------------------------------------------------
// Level 1: Syntax validation
// ---------------------------------------------------------------------------

/**
 * Attempt to parse the YAML content. Returns the parsed document or pushes
 * a syntax error.
 *
 * @param {string} content - Raw YAML text.
 * @param {Array} errors - Error accumulator.
 * @returns {object | null} Parsed document, or null on failure.
 */
function validateSyntax(content, errors) {
  try {
    const doc = yaml.load(content);
    return doc;
  } catch (err) {
    errors.push(makeError(
      `YAML syntax error: ${err.message}`,
      err.mark ? `line ${err.mark.line + 1}, column ${err.mark.column + 1}` : ''
    ));
    return null;
  }
}

// ---------------------------------------------------------------------------
// Level 2: Structure validation
// ---------------------------------------------------------------------------

/**
 * Validate that the document has the required top-level structure.
 *
 * @param {object} doc - Parsed YAML document.
 * @param {Array} errors - Error accumulator.
 * @param {Array} warnings - Warning accumulator.
 */
function validateStructure(doc, errors, warnings) {
  if (doc === null || doc === undefined || typeof doc !== 'object' || Array.isArray(doc)) {
    errors.push(makeError(
      'Document root must be a YAML mapping (object), not a scalar or array.',
      '/'
    ));
    return;
  }

  // Validate engine field if present.
  if (doc.engine !== undefined) {
    const engineVal = String(doc.engine).toLowerCase();
    if (engineVal !== 'native' && engineVal !== 'extended') {
      warnings.push(makeWarning(
        'Unknown engine value "' + doc.engine + '". Valid values are "native" or "extended".',
        '/engine'
      ));
    }
  }

  // Check for at least one platform config key.
  const rootKeys = Object.keys(doc);
  const hasPlatform = rootKeys.some((key) => PLATFORM_KEYS.has(key));
  if (!hasPlatform) {
    errors.push(makeError(
      'Document must contain at least one platform config key at root level: web, android, ios, or computer.',
      '/'
    ));
  }

  // Check for tasks array.
  if (!doc.tasks) {
    errors.push(makeError(
      'Document must contain a "tasks" array at root level.',
      '/tasks'
    ));
    return; // Cannot validate individual tasks if there is no tasks key.
  }

  if (!Array.isArray(doc.tasks)) {
    errors.push(makeError(
      '"tasks" must be an array.',
      '/tasks'
    ));
    return;
  }

  if (doc.tasks.length === 0) {
    errors.push(makeError(
      '"tasks" array must not be empty.',
      '/tasks'
    ));
    return;
  }

  // Validate each task.
  doc.tasks.forEach((task, index) => {
    const taskPath = `/tasks[${index}]`;

    if (task === null || task === undefined || typeof task !== 'object' || Array.isArray(task)) {
      errors.push(makeError(
        `Each task must be an object.`,
        taskPath
      ));
      return;
    }

    if (typeof task.name !== 'string' || task.name.trim() === '') {
      errors.push(makeError(
        `Task must have a "name" property of type string.`,
        `${taskPath}/name`
      ));
    }

    if (!Array.isArray(task.flow)) {
      errors.push(makeError(
        `Task must have a "flow" property of type array.`,
        `${taskPath}/flow`
      ));
    }
  });
}

// ---------------------------------------------------------------------------
// Level 3: Mode-aware validation
// ---------------------------------------------------------------------------

/**
 * Recursively collect all keys used in the document.
 *
 * @param {*} node - Current node.
 * @param {string} currentPath - JSON-pointer-like path for diagnostics.
 * @param {Array<{ key: string, path: string }>} result - Accumulator.
 */
function collectKeys(node, currentPath, result) {
  if (node === null || node === undefined || typeof node !== 'object') {
    return;
  }

  if (Array.isArray(node)) {
    node.forEach((item, i) => {
      collectKeys(item, `${currentPath}[${i}]`, result);
    });
    return;
  }

  for (const key of Object.keys(node)) {
    result.push({ key, path: `${currentPath}/${key}` });
    collectKeys(node[key], `${currentPath}/${key}`, result);
  }
}

/**
 * Perform native-mode validation: warn if extended keywords are present.
 *
 * @param {Array<{ key: string, path: string }>} allKeys
 * @param {Array} warnings
 */
function validateNativeMode(allKeys, warnings) {
  for (const entry of allKeys) {
    if (EXTENDED_FEATURE_KEYS.has(entry.key)) {
      warnings.push(makeWarning(
        `Extended keyword "${entry.key}" found in native mode. ` +
        `Consider switching to extended mode or removing this construct.`,
        entry.path
      ));
    }
  }
}

/**
 * Perform extended-mode validation: check that extended constructs are
 * well-formed.
 *
 * @param {object} doc - Parsed document.
 * @param {Array} errors - Error accumulator.
 * @param {Array} warnings - Warning accumulator.
 */
function validateExtendedMode(doc, errors, warnings) {
  // Walk every flow in every task and validate extended constructs.
  if (!doc.tasks || !Array.isArray(doc.tasks)) {
    return;
  }

  doc.tasks.forEach((task, taskIndex) => {
    if (!task || !Array.isArray(task.flow)) {
      return;
    }
    task.flow.forEach((step, stepIndex) => {
      const stepPath = `/tasks[${taskIndex}]/flow[${stepIndex}]`;
      validateExtendedStep(step, stepPath, errors, warnings);
    });
  });
}

/**
 * Validate a single flow step for extended construct correctness.
 * Recurses into nested flows (e.g. inside logic.then, logic.else, try.flow, etc.).
 *
 * @param {*} step
 * @param {string} stepPath
 * @param {Array} errors
 * @param {Array} warnings
 */
function validateExtendedStep(step, stepPath, errors, warnings) {
  if (step === null || step === undefined || typeof step !== 'object' || Array.isArray(step)) {
    return;
  }

  // --- logic ---
  if (step.logic !== undefined) {
    const logic = step.logic;
    const logicPath = `${stepPath}/logic`;

    if (logic === null || typeof logic !== 'object' || Array.isArray(logic)) {
      errors.push(makeError('"logic" must be an object.', logicPath));
    } else {
      if (logic.if === undefined) {
        errors.push(makeError('"logic" construct must have an "if" condition.', `${logicPath}/if`));
      }
      if (logic.then === undefined) {
        errors.push(makeError('"logic" construct must have a "then" branch.', `${logicPath}/then`));
      }

      // Recurse into then/else branches.
      if (Array.isArray(logic.then)) {
        logic.then.forEach((s, i) => {
          validateExtendedStep(s, `${logicPath}/then[${i}]`, errors, warnings);
        });
      }
      if (Array.isArray(logic.else)) {
        logic.else.forEach((s, i) => {
          validateExtendedStep(s, `${logicPath}/else[${i}]`, errors, warnings);
        });
      }
    }
  }

  // --- loop ---
  if (step.loop !== undefined) {
    const loop = step.loop;
    const loopPath = `${stepPath}/loop`;

    if (loop === null || typeof loop !== 'object' || Array.isArray(loop)) {
      errors.push(makeError('"loop" must be an object.', loopPath));
    } else {
      if (!loop.type) {
        errors.push(makeError('"loop" construct must have a "type" (for, while, or repeat).', `${loopPath}/type`));
      } else if (!LOOP_TYPES.has(loop.type)) {
        errors.push(makeError(
          `Invalid loop type "${loop.type}". Must be one of: for, while, repeat.`,
          `${loopPath}/type`
        ));
      } else {
        // Check required fields for the specific loop type.
        const required = LOOP_REQUIRED_FIELDS[loop.type] || [];
        for (const field of required) {
          if (loop[field] === undefined) {
            errors.push(makeError(
              `Loop of type "${loop.type}" requires a "${field}" field.`,
              `${loopPath}/${field}`
            ));
          }
        }
      }

      // Recurse into the loop's flow (accept both "flow" and "steps" keys).
      const loopFlow = loop.flow || loop.steps;
      if (Array.isArray(loopFlow)) {
        if (loopFlow.length === 0) {
          warnings.push(makeWarning(
            '"loop" has an empty flow/steps array.',
            `${loopPath}/flow`
          ));
        }
        loopFlow.forEach((s, i) => {
          validateExtendedStep(s, `${loopPath}/flow[${i}]`, errors, warnings);
        });
      } else if (!loopFlow) {
        warnings.push(makeWarning(
          '"loop" is missing a "flow" or "steps" array.',
          `${loopPath}/flow`
        ));
      }
    }
  }

  // --- try ---
  if (step.try !== undefined) {
    const tryBlock = step.try;
    const tryPath = `${stepPath}/try`;

    if (tryBlock === null || typeof tryBlock !== 'object' || Array.isArray(tryBlock)) {
      // try can also be expressed as an object with a flow key, or the value
      // itself can be the flow array in some schemas. We require an object with
      // a flow array.
      errors.push(makeError('"try" must be an object with a "flow" array.', tryPath));
    } else {
      // Accept both "flow" and "steps" keys for try/catch/finally blocks.
      const tryFlow = tryBlock.flow || tryBlock.steps;
      if (!Array.isArray(tryFlow)) {
        errors.push(makeError('"try" construct must have a "flow" (or "steps") array.', `${tryPath}/flow`));
      } else {
        tryFlow.forEach((s, i) => {
          validateExtendedStep(s, `${tryPath}/flow[${i}]`, errors, warnings);
        });
      }

      // Recurse into catch/finally if present (accept both "flow" and "steps").
      const catchBlock = tryBlock.catch;
      if (catchBlock) {
        const catchFlow = catchBlock.flow || catchBlock.steps;
        if (Array.isArray(catchFlow)) {
          catchFlow.forEach((s, i) => {
            validateExtendedStep(s, `${tryPath}/catch/flow[${i}]`, errors, warnings);
          });
        }
      }
      const finallyBlock = tryBlock.finally;
      if (finallyBlock) {
        const finallyFlow = finallyBlock.flow || finallyBlock.steps;
        if (Array.isArray(finallyFlow)) {
          finallyFlow.forEach((s, i) => {
            validateExtendedStep(s, `${tryPath}/finally/flow[${i}]`, errors, warnings);
          });
        }
      }
    }
  }

  // --- external_call ---
  if (step.external_call !== undefined) {
    const call = step.external_call;
    const callPath = `${stepPath}/external_call`;

    if (call === null || typeof call !== 'object' || Array.isArray(call)) {
      errors.push(makeError('"external_call" must be an object.', callPath));
    } else {
      if (!call.type) {
        errors.push(makeError(
          '"external_call" must have a "type" (http or shell).',
          `${callPath}/type`
        ));
      } else if (call.type !== 'http' && call.type !== 'shell') {
        errors.push(makeError(
          `Invalid external_call type "${call.type}". Must be "http" or "shell".`,
          `${callPath}/type`
        ));
      }
    }
  }

  // --- parallel ---
  if (step.parallel !== undefined) {
    const par = step.parallel;
    const parPath = `${stepPath}/parallel`;

    if (par === null || typeof par !== 'object' || Array.isArray(par)) {
      errors.push(makeError('"parallel" must be an object.', parPath));
    } else {
      const parTasks = par.tasks || par.branches;
      if (!Array.isArray(parTasks)) {
        errors.push(makeError(
          '"parallel" construct must have a "tasks" or "branches" array.',
          `${parPath}/tasks`
        ));
      } else {
        parTasks.forEach((t, i) => {
          const tFlow = t && (t.flow || t.steps);
          if (Array.isArray(tFlow)) {
            tFlow.forEach((s, si) => {
              validateExtendedStep(s, `${parPath}/tasks[${i}]/flow[${si}]`, errors, warnings);
            });
          }
        });
      }
    }
  }

  // --- use ---
  if (step.use !== undefined) {
    const useRef = step.use;
    const usePath = `${stepPath}/use`;

    if (typeof useRef !== 'string' || useRef.trim() === '') {
      errors.push(makeError('"use" must be a non-empty string (flow reference or path).', usePath));
    }

    if (step.with !== undefined && (step.with === null || typeof step.with !== 'object' || Array.isArray(step.with))) {
      errors.push(makeError('"with" must be an object mapping parameter names to values.', `${stepPath}/with`));
    }
  }

  // --- data_transform ---
  if (step.data_transform !== undefined) {
    const transform = step.data_transform;
    const transformPath = `${stepPath}/data_transform`;

    if (transform === null || typeof transform !== 'object' || Array.isArray(transform)) {
      errors.push(makeError('"data_transform" must be an object.', transformPath));
    } else {
      // Flat format: { source, operation, name }
      const VALID_OPERATIONS = ['filter', 'sort', 'map', 'reduce', 'unique', 'distinct', 'slice', 'flatten', 'groupBy'];

      if (transform.operation) {
        if (!VALID_OPERATIONS.includes(transform.operation)) {
          errors.push(makeError(
            'Invalid data_transform operation "' + transform.operation + '". Must be one of: ' + VALID_OPERATIONS.join(', ') + '.',
            `${transformPath}/operation`
          ));
        }
        if (!transform.source) {
          warnings.push(makeWarning(
            '"data_transform" with "operation" should have a "source" field.',
            `${transformPath}/source`
          ));
        }
      }

      // Nested format: { input, operations }
      if (transform.operations && !Array.isArray(transform.operations)) {
        errors.push(makeError('"data_transform.operations" must be an array.', `${transformPath}/operations`));
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Level 4: Semantic validation
// ---------------------------------------------------------------------------

/**
 * Collect all variable names that are defined within the document flows.
 * A variable is considered "defined" if it appears in:
 *   - A `variables` step (each key in the variables mapping).
 *   - An `aiQuery` step with a `name` property (the name becomes the variable).
 *   - An `import` step with an `as` property.
 *
 * @param {object} doc - Parsed document.
 * @returns {Set<string>} Set of defined variable names.
 */
function collectDefinedVariables(doc) {
  const defined = new Set();

  // Top-level variables block
  if (doc.variables && typeof doc.variables === 'object' && !Array.isArray(doc.variables)) {
    for (const varName of Object.keys(doc.variables)) {
      defined.add(varName);
    }
  }

  // Top-level import block
  if (doc.import && Array.isArray(doc.import)) {
    for (const imp of doc.import) {
      if (imp.as && typeof imp.as === 'string') {
        defined.add(imp.as);
      }
    }
  }

  if (!doc.tasks || !Array.isArray(doc.tasks)) {
    return defined;
  }

  for (const task of doc.tasks) {
    if (!task || !Array.isArray(task.flow)) {
      continue;
    }
    collectDefinedVariablesFromFlow(task.flow, defined);
  }

  return defined;
}

/**
 * Recursively collect defined variables from a flow array.
 *
 * @param {Array} flow
 * @param {Set<string>} defined
 */
function collectDefinedVariablesFromFlow(flow, defined) {
  for (const step of flow) {
    if (step === null || step === undefined || typeof step !== 'object') {
      continue;
    }

    // variables step: each key becomes a defined variable.
    if (step.variables && typeof step.variables === 'object' && !Array.isArray(step.variables)) {
      for (const varName of Object.keys(step.variables)) {
        defined.add(varName);
      }
    }

    // aiQuery with name: the name becomes a defined variable.
    if (step.aiQuery && typeof step.aiQuery === 'object' && typeof step.aiQuery.name === 'string') {
      defined.add(step.aiQuery.name);
    }
    // Also support shorthand where aiQuery is a string but a sibling "name" key holds the variable.
    if (step.aiQuery !== undefined && typeof step.name === 'string') {
      defined.add(step.name);
    }

    // import with as: the alias becomes a defined variable.
    if (step.import !== undefined && typeof step.as === 'string') {
      defined.add(step.as);
    }

    // external_call with response_as/as/name: the variable becomes defined.
    if (step.external_call && typeof step.external_call === 'object') {
      const ecVar = step.external_call.response_as || step.external_call.as || step.external_call.name;
      if (typeof ecVar === 'string') {
        defined.add(ecVar);
      }
    }

    // data_transform with output/name: the variable becomes defined.
    if (step.data_transform && typeof step.data_transform === 'object') {
      const dtVar = step.data_transform.output || step.data_transform.name;
      if (typeof dtVar === 'string') {
        defined.add(dtVar);
      }
    }

    // Recurse into nested flows.
    if (step.logic && typeof step.logic === 'object') {
      if (Array.isArray(step.logic.then)) {
        collectDefinedVariablesFromFlow(step.logic.then, defined);
      }
      if (Array.isArray(step.logic.else)) {
        collectDefinedVariablesFromFlow(step.logic.else, defined);
      }
    }
    if (step.loop && typeof step.loop === 'object') {
      const loopFlow = step.loop.flow || step.loop.steps;
      // The loop "as"/"itemVar"/"item" variable is a defined variable within the loop.
      const loopVar = step.loop.itemVar || step.loop.as || step.loop.item;
      if (typeof loopVar === 'string') {
        defined.add(loopVar);
      }
      if (Array.isArray(loopFlow)) {
        collectDefinedVariablesFromFlow(loopFlow, defined);
      }
    }
    if (step.try && typeof step.try === 'object') {
      const tryFlow = step.try.flow || step.try.steps;
      if (Array.isArray(tryFlow)) {
        collectDefinedVariablesFromFlow(tryFlow, defined);
      }
    }
    if (step.parallel && typeof step.parallel === 'object') {
      const parTasks = step.parallel.tasks || step.parallel.branches;
      if (Array.isArray(parTasks)) {
        for (const t of parTasks) {
          const tFlow = t && (t.flow || t.steps);
          if (Array.isArray(tFlow)) {
            collectDefinedVariablesFromFlow(tFlow, defined);
          }
        }
      }
    }
  }
}

/**
 * Collect all ${...} template variable references found in string values
 * throughout the document.
 *
 * @param {*} node - Current node.
 * @param {string} currentPath - Path for diagnostics.
 * @param {Array<{ varName: string, path: string }>} result - Accumulator.
 */
function collectVariableReferences(node, currentPath, result) {
  if (node === null || node === undefined) {
    return;
  }

  if (typeof node === 'string') {
    let match;
    // Reset regex state.
    TEMPLATE_VAR_REGEX.lastIndex = 0;
    while ((match = TEMPLATE_VAR_REGEX.exec(node)) !== null) {
      // Extract the root variable name (before any dots or brackets).
      const fullRef = match[1];
      const rootVar = fullRef.split('.')[0].split('[')[0].trim();
      result.push({ varName: rootVar, path: currentPath });
    }
    return;
  }

  if (Array.isArray(node)) {
    node.forEach((item, i) => {
      collectVariableReferences(item, `${currentPath}[${i}]`, result);
    });
    return;
  }

  if (typeof node === 'object') {
    for (const key of Object.keys(node)) {
      collectVariableReferences(node[key], `${currentPath}/${key}`, result);
    }
  }
}

/**
 * Check that all ${...} variable references resolve to a variable that is
 * defined somewhere in the document.
 *
 * @param {object} doc - Parsed document.
 * @param {Array} warnings - Warning accumulator.
 */
function validateVariableReferences(doc, warnings) {
  const defined = collectDefinedVariables(doc);
  const references = [];
  collectVariableReferences(doc, '', references);

  for (const ref of references) {
    if (!defined.has(ref.varName)) {
      warnings.push(makeWarning(
        `Variable "\${${ref.varName}}" is referenced but does not appear to be defined ` +
        `in a prior "variables" step, "aiQuery" name, or "import" alias.`,
        ref.path
      ));
    }
  }
}

/**
 * Collect all import paths from the document and check that the referenced
 * files exist on disk.
 *
 * @param {object} doc - Parsed document.
 * @param {string} basePath - Base directory for resolving relative paths.
 * @param {Array} warnings - Warning accumulator.
 */
function validateImportPaths(doc, basePath, warnings) {
  if (!doc.tasks || !Array.isArray(doc.tasks)) {
    return;
  }

  const imports = [];
  collectImports(doc.tasks, '', imports);

  for (const entry of imports) {
    const importPath = entry.importPath;

    // Skip if the path looks like a template variable.
    if (TEMPLATE_VAR_REGEX.test(importPath)) {
      continue;
    }

    const resolved = path.resolve(basePath, importPath);
    if (!fs.existsSync(resolved)) {
      warnings.push(makeWarning(
        `Import path "${importPath}" does not exist (resolved to "${resolved}").`,
        entry.path
      ));
    }
  }
}

/**
 * Recursively collect import step paths from task flows.
 *
 * @param {Array} tasks - Array of tasks or flow steps.
 * @param {string} prefix - Path prefix for diagnostics.
 * @param {Array<{ importPath: string, path: string }>} result
 */
function collectImports(tasks, prefix, result) {
  for (let i = 0; i < tasks.length; i++) {
    const item = tasks[i];
    if (!item || typeof item !== 'object') {
      continue;
    }

    // If this is a task with a flow, recurse into the flow.
    if (Array.isArray(item.flow)) {
      const flowPrefix = prefix ? `${prefix}/flow` : `/tasks[${i}]/flow`;
      collectImportsFromFlow(item.flow, flowPrefix, result);
    }

    // If the item itself has tasks (top-level tasks array).
    if (Array.isArray(item.tasks)) {
      collectImports(item.tasks, `${prefix}[${i}]`, result);
    }
  }
}

/**
 * Recursively collect import paths from a flow array.
 *
 * @param {Array} flow
 * @param {string} prefix
 * @param {Array<{ importPath: string, path: string }>} result
 */
function collectImportsFromFlow(flow, prefix, result) {
  for (let i = 0; i < flow.length; i++) {
    const step = flow[i];
    if (!step || typeof step !== 'object') {
      continue;
    }

    // Direct import step.
    if (step.import !== undefined && typeof step.import === 'string') {
      result.push({
        importPath: step.import,
        path: `${prefix}[${i}]/import`,
      });
    }

    // Recurse into nested constructs.
    if (step.logic && typeof step.logic === 'object') {
      if (Array.isArray(step.logic.then)) {
        collectImportsFromFlow(step.logic.then, `${prefix}[${i}]/logic/then`, result);
      }
      if (Array.isArray(step.logic.else)) {
        collectImportsFromFlow(step.logic.else, `${prefix}[${i}]/logic/else`, result);
      }
    }
    if (step.loop && typeof step.loop === 'object') {
      const loopFlow = step.loop.flow || step.loop.steps;
      if (Array.isArray(loopFlow)) {
        collectImportsFromFlow(loopFlow, `${prefix}[${i}]/loop/flow`, result);
      }
    }
    if (step.try && typeof step.try === 'object') {
      const tryFlow = step.try.flow || step.try.steps;
      if (Array.isArray(tryFlow)) {
        collectImportsFromFlow(tryFlow, `${prefix}[${i}]/try/flow`, result);
      }
    }
    if (step.parallel && typeof step.parallel === 'object' && Array.isArray(step.parallel.tasks)) {
      for (let t = 0; t < step.parallel.tasks.length; t++) {
        const pt = step.parallel.tasks[t];
        if (pt && Array.isArray(pt.flow)) {
          collectImportsFromFlow(pt.flow, `${prefix}[${i}]/parallel/tasks[${t}]/flow`, result);
        }
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Validate a Midscene YAML Superset document through four levels:
 *   1. Syntax validation (can the YAML be parsed?)
 *   2. Structure validation (required top-level keys and task shape)
 *   3. Mode-aware validation (native keyword warnings or extended construct checks)
 *   4. Semantic validation (variable references and import paths)
 *
 * @param {string} yamlInput - A file path (`.yaml`/`.yml`) or raw YAML string.
 * @param {object} [options] - Optional configuration.
 * @param {string} [options.basePath] - Base directory for resolving import paths
 *   (defaults to the YAML file's directory or CWD).
 * @param {'native'|'extended'} [options.mode] - Force a specific validation mode
 *   instead of auto-detecting.
 * @returns {{ valid: boolean, errors: Array<{level: string, message: string, path: string}>, warnings: Array<{level: string, message: string, path: string}> }}
 */
function validate(yamlInput, options) {
  const opts = options || {};
  const errors = [];
  const warnings = [];

  // ------------------------------------------------------------------
  // 0. Input guard
  // ------------------------------------------------------------------
  if (typeof yamlInput !== 'string' || yamlInput.trim() === '') {
    errors.push(makeError('Input must be a non-empty string (file path or YAML content).', ''));
    return { valid: false, errors, warnings };
  }

  // ------------------------------------------------------------------
  // Resolve raw content and determine the file path (if any).
  // ------------------------------------------------------------------
  let content;
  let filePath;
  try {
    const resolved = resolveContent(yamlInput);
    content = resolved.content;
    filePath = resolved.filePath;
  } catch (err) {
    errors.push(makeError(`Unable to read input: ${err.message}`, ''));
    return { valid: false, errors, warnings };
  }

  // Determine basePath for import resolution.
  const basePath = opts.basePath
    ? path.resolve(opts.basePath)
    : filePath
      ? path.dirname(filePath)
      : process.cwd();

  // ------------------------------------------------------------------
  // Level 1: Syntax validation
  // ------------------------------------------------------------------
  const doc = validateSyntax(content, errors);
  if (doc === null) {
    // Cannot continue if YAML is unparseable.
    return { valid: false, errors, warnings };
  }

  // ------------------------------------------------------------------
  // Level 2: Structure validation
  // ------------------------------------------------------------------
  validateStructure(doc, errors, warnings);

  // If there are structure errors, further validation may be unreliable
  // but we continue to provide as many diagnostics as possible.

  // ------------------------------------------------------------------
  // Level 3: Mode-aware validation
  // ------------------------------------------------------------------
  let mode = opts.mode;
  if (!mode) {
    // Auto-detect mode from the content.
    const detection = detect(content);
    mode = detection.mode;
  }

  // Collect all keys for mode analysis.
  const allKeys = [];
  collectKeys(doc, '', allKeys);

  if (mode === 'native') {
    validateNativeMode(allKeys, warnings);
  } else if (mode === 'extended') {
    validateExtendedMode(doc, errors, warnings);
  }

  // ------------------------------------------------------------------
  // Level 4: Semantic validation
  // ------------------------------------------------------------------
  validateVariableReferences(doc, warnings);
  validateImportPaths(doc, basePath, warnings);

  // ------------------------------------------------------------------
  // Result
  // ------------------------------------------------------------------
  const hasErrors = errors.some((e) => e.level === 'error');
  return {
    valid: !hasErrors,
    errors,
    warnings,
  };
}

module.exports = {
  validate,
};
