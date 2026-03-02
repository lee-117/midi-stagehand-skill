'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

// ---------------------------------------------------------------------------
// Integration tests — Generator-style YAML through detect → validate → transpile
// ---------------------------------------------------------------------------
const { detect } = require('../src/detector/mode-detector');
const { validate } = require('../src/validator/yaml-validator');
const { transpile } = require('../src/transpiler/transpiler');

// ---------------------------------------------------------------------------
// 1. Generator-style Native YAML flows through pipeline
// ---------------------------------------------------------------------------
describe('Integration-Skills: Generator-style Native YAML', () => {
  it('web platform with generator comments flows through detect + validate', () => {
    const yaml = [
      '# 自动生成 by Midscene YAML Generator',
      '# validated: 2026-03-01T12:00:00Z',
      'engine: native',
      '',
      'web:',
      '  url: "https://example.com"',
      '  headless: true',
      '',
      'tasks:',
      '  - name: "登录测试"',
      '    flow:',
      '      - aiTap: "登录按钮"',
      '      - aiInput: "用户名输入框"',
      '        value: "admin"',
      '      - aiAssert: "登录成功"',
    ].join('\n');

    const detection = detect(yaml);
    assert.equal(detection.mode, 'native');
    assert.equal(detection.needs_transpilation, false);
    assert.deepEqual(detection.features, []);

    const result = validate(yaml);
    assert.equal(result.valid, true, `Should be valid: ${JSON.stringify(result.errors)}`);
    assert.ok(Array.isArray(result.errors));
    assert.ok(Array.isArray(result.warnings));
  });

  it('web platform generator YAML transpiles correctly', () => {
    const yaml = [
      '# 自动生成 by Midscene YAML Generator',
      'engine: native',
      '',
      'web:',
      '  url: "https://example.com"',
      '',
      'tasks:',
      '  - name: "搜索测试"',
      '    flow:',
      '      - aiTap: "搜索框"',
      '      - aiInput: "搜索输入框"',
      '        value: "midscene"',
      '      - aiTap: "搜索按钮"',
    ].join('\n');

    const transpileResult = transpile(yaml);
    assert.ok(transpileResult.code, 'Should produce code');
    assert.ok(transpileResult.code.length > 0);
    assert.ok(transpileResult.code.includes('example.com'), 'Should contain the URL');
  });

  it('android platform with generator comments detects and validates', () => {
    const yaml = [
      '# 自动生成 by Midscene YAML Generator',
      '# validated: 2026-03-01T12:00:00Z',
      '',
      'android:',
      '  deviceId: "emulator-5554"',
      '',
      'tasks:',
      '  - name: "安卓应用测试"',
      '    flow:',
      '      - aiTap: "设置按钮"',
      '      - aiAssert: "设置页面已显示"',
    ].join('\n');

    const detection = detect(yaml);
    assert.equal(detection.mode, 'native');
    assert.equal(detection.needs_transpilation, false);

    const result = validate(yaml);
    assert.equal(result.valid, true, `Should be valid: ${JSON.stringify(result.errors)}`);
  });
});

// ---------------------------------------------------------------------------
// 2. Generator-style Extended YAML flows through pipeline
// ---------------------------------------------------------------------------
describe('Integration-Skills: Generator-style Extended YAML', () => {
  const extendedYaml = [
    '# 自动生成 by Midscene YAML Generator',
    '# validated: 2026-03-01T12:00:00Z',
    'engine: extended',
    'features:',
    '  - variables',
    '  - logic',
    '  - loop',
    '',
    'web:',
    '  url: "https://example.com/app"',
    '',
    'variables:',
    '  username: "testuser"',
    '  maxRetries: 3',
    '',
    'tasks:',
    '  - name: "扩展模式综合测试"',
    '    flow:',
    '      - logic:',
    '          if: "页面上有登录表单"',
    '          then:',
    '            - aiInput: "用户名输入框"',
    '              value: "${username}"',
    '            - aiTap: "登录按钮"',
    '          else:',
    '            - ai: "已经登录，继续操作"',
    '',
    '      - loop:',
    '          type: repeat',
    '          count: "${maxRetries}"',
    '          flow:',
    '            - aiTap: "加载更多"',
    '            - sleep: 1000',
  ].join('\n');

  it('detects extended mode with correct features', () => {
    const detection = detect(extendedYaml);
    assert.equal(detection.mode, 'extended');
    assert.equal(detection.needs_transpilation, true);
    assert.ok(detection.features.includes('variables'), 'Should detect variables feature');
    assert.ok(detection.features.includes('logic'), 'Should detect logic feature');
    assert.ok(detection.features.includes('loop'), 'Should detect loop feature');
  });

  it('validates as valid', () => {
    const result = validate(extendedYaml);
    assert.equal(result.valid, true, `Should be valid: ${JSON.stringify(result.errors)}`);
  });

  it('transpiles to TypeScript with expected patterns', () => {
    const transpileResult = transpile(extendedYaml);
    assert.ok(transpileResult.code, 'Should produce code');
    assert.ok(typeof transpileResult.code === 'string');
    assert.ok(transpileResult.code.length > 0);
    assert.ok(Array.isArray(transpileResult.warnings));

    // Should contain if/else for logic
    assert.ok(transpileResult.code.includes('if'), 'Should contain if statement');
    // Should contain loop construct
    assert.ok(
      transpileResult.code.includes('for') || transpileResult.code.includes('while'),
      'Should contain loop construct'
    );
    // Should contain variable references
    assert.ok(transpileResult.code.includes('username'), 'Should reference username variable');
    assert.ok(transpileResult.code.includes('maxRetries'), 'Should reference maxRetries variable');
  });

  it('extended YAML with data_transform transpiles correctly', () => {
    const yaml = [
      'engine: extended',
      '',
      'web:',
      '  url: "https://example.com"',
      '',
      'variables:',
      '  items: []',
      '',
      'tasks:',
      '  - name: "数据转换测试"',
      '    flow:',
      '      - aiQuery: "提取所有商品信息"',
      '        name: products',
      '      - data_transform:',
      '          input: "${products}"',
      '          operations:',
      '            - filter: "price > 0"',
      '            - sort: "price desc"',
      '          output: filteredProducts',
    ].join('\n');

    const detection = detect(yaml);
    assert.equal(detection.mode, 'extended');
    assert.ok(detection.features.includes('data_transform'));

    const result = validate(yaml);
    assert.equal(result.valid, true, `Should be valid: ${JSON.stringify(result.errors)}`);

    const transpileResult = transpile(yaml);
    assert.ok(transpileResult.code, 'Should produce code');
    assert.ok(
      transpileResult.code.includes('filter') || transpileResult.code.includes('sort'),
      'Should contain data transform operations'
    );
  });
});

// ---------------------------------------------------------------------------
// 3. freezePageContext / unfreezePageContext in native YAML
// ---------------------------------------------------------------------------
describe('Integration-Skills: freezePageContext / unfreezePageContext', () => {
  it('freezePageContext validates and transpiles correctly', () => {
    const yaml = [
      'web:',
      '  url: "https://example.com"',
      '',
      'tasks:',
      '  - name: "冻结页面上下文测试"',
      '    flow:',
      '      - freezePageContext: true',
      '      - aiQuery: "提取价格信息"',
      '        name: prices',
      '      - unfreezePageContext: true',
    ].join('\n');

    const detection = detect(yaml);
    assert.equal(detection.mode, 'native');

    const result = validate(yaml);
    assert.equal(result.valid, true, `Should be valid: ${JSON.stringify(result.errors)}`);

    const transpileResult = transpile(yaml);
    assert.ok(transpileResult.code, 'Should produce code');
    assert.ok(
      transpileResult.code.includes('agent.freezePageContext()'),
      'Should generate agent.freezePageContext() call'
    );
    assert.ok(
      transpileResult.code.includes('agent.unfreezePageContext()'),
      'Should generate agent.unfreezePageContext() call'
    );
  });

  it('freezePageContext step alone validates without errors', () => {
    const yaml = [
      'web:',
      '  url: "https://example.com"',
      '',
      'tasks:',
      '  - name: "仅冻结"',
      '    flow:',
      '      - freezePageContext: true',
      '      - aiAssert: "页面已冻结"',
    ].join('\n');

    const result = validate(yaml);
    assert.equal(result.valid, true, `Should be valid: ${JSON.stringify(result.errors)}`);
  });
});

// ---------------------------------------------------------------------------
// 4. outputFormat config field validates correctly
// ---------------------------------------------------------------------------
describe('Integration-Skills: outputFormat config field', () => {
  it('web.outputFormat: single-html produces no unknown field warning', () => {
    const yaml = [
      'web:',
      '  url: "https://example.com"',
      '  outputFormat: "single-html"',
      '',
      'tasks:',
      '  - name: "输出格式测试"',
      '    flow:',
      '      - aiTap: "按钮"',
    ].join('\n');

    const result = validate(yaml);
    assert.equal(result.valid, true, `Should be valid: ${JSON.stringify(result.errors)}`);

    const outputFormatWarnings = result.warnings.filter(
      (w) => w.message && w.message.includes('outputFormat')
    );
    assert.equal(
      outputFormatWarnings.length,
      0,
      'Should not warn about outputFormat: ' + JSON.stringify(outputFormatWarnings)
    );
  });

  it('web.outputFormat validates as part of full generator-style YAML', () => {
    const yaml = [
      '# 自动生成 by Midscene YAML Generator',
      'engine: native',
      '',
      'web:',
      '  url: "https://example.com"',
      '  outputFormat: "single-html"',
      '  headless: true',
      '',
      'tasks:',
      '  - name: "完整生成器输出"',
      '    flow:',
      '      - aiTap: "链接"',
      '      - aiAssert: "页面加载"',
    ].join('\n');

    const detection = detect(yaml);
    assert.equal(detection.mode, 'native');

    const result = validate(yaml);
    assert.equal(result.valid, true, `Should be valid: ${JSON.stringify(result.errors)}`);
  });
});

// ---------------------------------------------------------------------------
// 5. cache.id warning when strategy is set without id
// ---------------------------------------------------------------------------
describe('Integration-Skills: cache.strategy without cache.id', () => {
  it('warns when cache.strategy is set but cache.id is missing', () => {
    const yaml = [
      'web:',
      '  url: "https://example.com"',
      '',
      'agent:',
      '  cache:',
      '    strategy: "read-write"',
      '',
      'tasks:',
      '  - name: "缓存测试"',
      '    flow:',
      '      - aiTap: "按钮"',
    ].join('\n');

    const result = validate(yaml);
    assert.equal(result.valid, true, 'Should still be valid (warning, not error)');

    const cacheWarnings = result.warnings.filter(
      (w) => w.message && w.message.includes('cache') && w.message.includes('id')
    );
    assert.ok(
      cacheWarnings.length > 0,
      'Should warn about missing cache.id: ' + JSON.stringify(result.warnings)
    );
  });

  it('no warning when both cache.strategy and cache.id are present', () => {
    const yaml = [
      'web:',
      '  url: "https://example.com"',
      '',
      'agent:',
      '  cache:',
      '    strategy: "read-write"',
      '    id: "my-cache-id"',
      '',
      'tasks:',
      '  - name: "缓存测试-完整"',
      '    flow:',
      '      - aiTap: "按钮"',
    ].join('\n');

    const result = validate(yaml);
    assert.equal(result.valid, true, `Should be valid: ${JSON.stringify(result.errors)}`);

    const cacheIdWarnings = result.warnings.filter(
      (w) => w.message && w.message.includes('cache') && w.message.includes('"id" is missing')
    );
    assert.equal(
      cacheIdWarnings.length,
      0,
      'Should not warn about missing cache.id when it is present'
    );
  });
});

// ---------------------------------------------------------------------------
// 6. iOS config validation
// ---------------------------------------------------------------------------
describe('Integration-Skills: iOS config validation', () => {
  it('valid iOS config (wdaPort, wdaHost) produces no warnings', () => {
    const yaml = [
      'ios:',
      '  wdaPort: 8100',
      '  wdaHost: "localhost"',
      '',
      'tasks:',
      '  - name: "iOS有效配置"',
      '    flow:',
      '      - aiTap: "按钮"',
    ].join('\n');

    const result = validate(yaml);
    assert.equal(result.valid, true, `Should be valid: ${JSON.stringify(result.errors)}`);

    const iosWarnings = result.warnings.filter(
      (w) => w.message && w.message.includes('ios')
    );
    assert.equal(
      iosWarnings.length,
      0,
      'Should not have iOS-related warnings: ' + JSON.stringify(iosWarnings)
    );
  });

  it('unknown iOS field produces warning', () => {
    const yaml = [
      'ios:',
      '  wdaPort: 8100',
      '  unknownIosField: "value"',
      '',
      'tasks:',
      '  - name: "iOS未知字段"',
      '    flow:',
      '      - aiTap: "按钮"',
    ].join('\n');

    const result = validate(yaml);
    assert.equal(result.valid, true, 'Should still be valid (warning, not error)');

    const iosWarnings = result.warnings.filter(
      (w) => w.message && w.message.includes('Unknown ios config field')
    );
    assert.ok(
      iosWarnings.length > 0,
      'Should warn about unknown iOS field: ' + JSON.stringify(result.warnings)
    );
    assert.ok(
      iosWarnings[0].message.includes('unknownIosField'),
      'Warning should mention the unknown field name'
    );
  });
});

// ---------------------------------------------------------------------------
// 7. Computer config validation
// ---------------------------------------------------------------------------
describe('Integration-Skills: Computer config validation', () => {
  it('valid computer config (displayId) produces no warnings', () => {
    const yaml = [
      'computer:',
      '  displayId: 1',
      '',
      'tasks:',
      '  - name: "Computer有效配置"',
      '    flow:',
      '      - aiTap: "按钮"',
    ].join('\n');

    const result = validate(yaml);
    assert.equal(result.valid, true, `Should be valid: ${JSON.stringify(result.errors)}`);

    const computerWarnings = result.warnings.filter(
      (w) => w.message && w.message.includes('computer')
    );
    assert.equal(
      computerWarnings.length,
      0,
      'Should not have computer-related warnings: ' + JSON.stringify(computerWarnings)
    );
  });

  it('unknown computer field produces warning', () => {
    const yaml = [
      'computer:',
      '  displayId: 1',
      '  unknownComputerField: true',
      '',
      'tasks:',
      '  - name: "Computer未知字段"',
      '    flow:',
      '      - aiTap: "按钮"',
    ].join('\n');

    const result = validate(yaml);
    assert.equal(result.valid, true, 'Should still be valid (warning, not error)');

    const computerWarnings = result.warnings.filter(
      (w) => w.message && w.message.includes('Unknown computer config field')
    );
    assert.ok(
      computerWarnings.length > 0,
      'Should warn about unknown computer field: ' + JSON.stringify(result.warnings)
    );
    assert.ok(
      computerWarnings[0].message.includes('unknownComputerField'),
      'Warning should mention the unknown field name'
    );
  });
});

// ---------------------------------------------------------------------------
// 8. unstableLogContent in web config validates without warning
// ---------------------------------------------------------------------------
describe('Integration-Skills: unstableLogContent in web config', () => {
  it('web.unstableLogContent validates without unknown-field warning', () => {
    const yaml = [
      'web:',
      '  url: "https://example.com"',
      '  unstableLogContent: true',
      '',
      'tasks:',
      '  - name: "日志内容测试"',
      '    flow:',
      '      - aiTap: "按钮"',
    ].join('\n');

    const result = validate(yaml);
    assert.equal(result.valid, true, `Should be valid: ${JSON.stringify(result.errors)}`);

    const logContentWarnings = result.warnings.filter(
      (w) => w.message && w.message.includes('unstableLogContent')
    );
    assert.equal(
      logContentWarnings.length,
      0,
      'Should not warn about unstableLogContent: ' + JSON.stringify(logContentWarnings)
    );
  });

  it('unstableLogContent in iOS config also validates without warning', () => {
    const yaml = [
      'ios:',
      '  wdaPort: 8100',
      '  unstableLogContent: true',
      '',
      'tasks:',
      '  - name: "iOS日志内容测试"',
      '    flow:',
      '      - aiTap: "按钮"',
    ].join('\n');

    const result = validate(yaml);
    assert.equal(result.valid, true, `Should be valid: ${JSON.stringify(result.errors)}`);

    const logContentWarnings = result.warnings.filter(
      (w) => w.message && w.message.includes('unstableLogContent')
    );
    assert.equal(
      logContentWarnings.length,
      0,
      'Should not warn about unstableLogContent in iOS config'
    );
  });
});

// ---------------------------------------------------------------------------
// 9. viewportHeight defaults to 960 in transpiled output
// ---------------------------------------------------------------------------
describe('Integration-Skills: viewportHeight default', () => {
  it('minimal web YAML without explicit viewportHeight defaults to 960', () => {
    const yaml = [
      'web:',
      '  url: "https://example.com"',
      '',
      'tasks:',
      '  - name: "默认视口高度"',
      '    flow:',
      '      - aiTap: "按钮"',
    ].join('\n');

    const transpileResult = transpile(yaml);
    assert.ok(transpileResult.code, 'Should produce code');
    assert.ok(
      transpileResult.code.includes('960'),
      'Transpiled output should contain 960 as default viewportHeight'
    );
    // Ensure it does NOT use the old 720 default
    // (Only check for 720 in viewport context, not in other numbers)
    const viewportMatch = transpileResult.code.match(/viewport\s*:\s*\{[^}]*height\s*:\s*(\d+)/);
    if (viewportMatch) {
      assert.equal(
        viewportMatch[1],
        '960',
        'viewport.height should be 960, not ' + viewportMatch[1]
      );
    }
  });

  it('explicit viewportHeight overrides the default', () => {
    const yaml = [
      'web:',
      '  url: "https://example.com"',
      '  viewportHeight: 1080',
      '',
      'tasks:',
      '  - name: "自定义视口高度"',
      '    flow:',
      '      - aiTap: "按钮"',
    ].join('\n');

    const transpileResult = transpile(yaml);
    assert.ok(transpileResult.code, 'Should produce code');
    assert.ok(
      transpileResult.code.includes('1080'),
      'Transpiled output should contain the explicit viewportHeight 1080'
    );
  });
});

// ---------------------------------------------------------------------------
// Bonus: End-to-end Generator → Runner pipeline simulation
// ---------------------------------------------------------------------------
describe('Integration-Skills: Full Generator-style pipeline round trip', () => {
  it('complex Generator-style Extended YAML passes all 3 stages', () => {
    const yaml = [
      '# 自动生成 by Midscene YAML Generator',
      '# platform: web',
      '# complexity: high',
      '# validated: 2026-03-01T12:00:00Z',
      'engine: extended',
      'features:',
      '  - variables',
      '  - logic',
      '  - loop',
      '  - try_catch',
      '',
      'web:',
      '  url: "https://example.com/dashboard"',
      '  headless: true',
      '',
      'variables:',
      '  searchTerm: "midscene"',
      '  maxPages: 3',
      '',
      'tasks:',
      '  - name: "搜索与分页"',
      '    flow:',
      '      - aiInput: "搜索框"',
      '        value: "${searchTerm}"',
      '      - aiTap: "搜索按钮"',
      '',
      '      - try:',
      '          flow:',
      '            - aiWaitFor: "搜索结果已加载"',
      '              timeout: 10000',
      '            - logic:',
      '                if: "有搜索结果"',
      '                then:',
      '                  - loop:',
      '                      type: repeat',
      '                      count: "${maxPages}"',
      '                      flow:',
      '                        - aiTap: "下一页"',
      '                        - sleep: 1000',
      '                else:',
      '                  - aiAssert: "显示无结果提示"',
      '        catch:',
      '          flow:',
      '            - recordToReport: "搜索失败"',
      '              content: "搜索流程出现异常"',
    ].join('\n');

    // Stage 1: Detect
    const detection = detect(yaml);
    assert.equal(detection.mode, 'extended');
    assert.equal(detection.needs_transpilation, true);
    assert.ok(detection.features.includes('variables'));
    assert.ok(detection.features.includes('logic'));
    assert.ok(detection.features.includes('loop'));

    // Stage 2: Validate
    const result = validate(yaml);
    assert.equal(result.valid, true, `Should be valid: ${JSON.stringify(result.errors)}`);

    // Stage 3: Transpile
    const transpileResult = transpile(yaml);
    assert.ok(transpileResult.code, 'Should produce code');
    assert.ok(transpileResult.code.length > 100, 'Generated code should be substantial');
    assert.ok(transpileResult.code.includes('searchTerm'), 'Should reference searchTerm variable');
    assert.ok(transpileResult.code.includes('if'), 'Should contain if statement');
    assert.ok(
      transpileResult.code.includes('for') || transpileResult.code.includes('while'),
      'Should contain loop construct'
    );
    assert.ok(
      transpileResult.code.includes('try') && transpileResult.code.includes('catch'),
      'Should contain try/catch'
    );
  });
});
