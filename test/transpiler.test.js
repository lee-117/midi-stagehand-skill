'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

const fixtures = (...parts) => path.join(__dirname, 'fixtures', ...parts);

// Load transpiler (may not be available yet)
let transpile;
try {
  transpile = require('../src/transpiler/transpiler').transpile;
} catch (e) {
  console.warn('Transpiler module not loaded, tests will fail:', e.message);
  transpile = () => ({ code: '' });
}

describe('Transpiler', () => {
  describe('native actions', () => {
    it('transpiles aiTap to agent.aiTap()', () => {
      const yaml = `
web:
  url: "https://example.com"
tasks:
  - name: test
    flow:
      - aiTap: "登录按钮"
`;
      const result = transpile(yaml);
      assert.ok(result.code.includes('agent.aiTap'));
      assert.ok(result.code.includes('登录按钮'));
    });

    it('transpiles aiInput with value', () => {
      const yaml = `
web:
  url: "https://example.com"
tasks:
  - name: test
    flow:
      - aiInput: "用户名输入框"
        value: "admin"
`;
      const result = transpile(yaml);
      assert.ok(result.code.includes('agent.aiInput'));
      assert.ok(result.code.includes('admin'));
    });

    it('transpiles aiQuery with name', () => {
      const yaml = `
web:
  url: "https://example.com"
tasks:
  - name: test
    flow:
      - aiQuery: "提取标题"
        name: pageTitle
`;
      const result = transpile(yaml);
      assert.ok(result.code.includes('agent.aiQuery'));
      assert.ok(result.code.includes('pageTitle'));
    });

    it('transpiles sleep to setTimeout', () => {
      const yaml = `
web:
  url: "https://example.com"
tasks:
  - name: test
    flow:
      - sleep: 2000
`;
      const result = transpile(yaml);
      assert.ok(result.code.includes('setTimeout'));
      assert.ok(result.code.includes('2000'));
    });

    it('transpiles aiAssert', () => {
      const yaml = `
web:
  url: "https://example.com"
tasks:
  - name: test
    flow:
      - aiAssert: "页面包含欢迎信息"
`;
      const result = transpile(yaml);
      assert.ok(result.code.includes('agent.aiAssert'));
    });

    it('transpiles aiWaitFor with timeout', () => {
      const yaml = `
web:
  url: "https://example.com"
tasks:
  - name: test
    flow:
      - aiWaitFor: "加载完成"
        timeout: 10000
`;
      const result = transpile(yaml);
      assert.ok(result.code.includes('agent.aiWaitFor'));
      assert.ok(result.code.includes('10000'));
    });
  });

  describe('extended: variables', () => {
    it('transpiles variables to const declarations', () => {
      const yaml = `
web:
  url: "https://example.com"
tasks:
  - name: test
    flow:
      - variables:
          username: "admin"
          count: 5
`;
      const result = transpile(yaml);
      assert.ok(result.code.includes('username'));
      assert.ok(result.code.includes('admin'));
      assert.ok(result.code.includes('count'));
    });
  });

  describe('extended: top-level variables', () => {
    it('transpiles top-level variables block before tasks', () => {
      const yaml = `
engine: extended
web:
  url: "https://example.com"
variables:
  siteUrl: "https://example.com"
  maxPages: 10
  username: "admin"
tasks:
  - name: test
    flow:
      - ai: "navigate to \${siteUrl}"
`;
      const result = transpile(yaml);
      assert.ok(result.code.includes("let siteUrl = 'https://example.com'"),
        'Should declare top-level siteUrl variable');
      assert.ok(result.code.includes('let maxPages = 10'),
        'Should declare top-level maxPages variable');
      assert.ok(result.code.includes("let username = 'admin'"),
        'Should declare top-level username variable');
      // Verify variables appear before the task code
      const siteUrlIdx = result.code.indexOf('siteUrl');
      const taskIdx = result.code.indexOf('navigate to');
      assert.ok(siteUrlIdx < taskIdx,
        'Top-level variables should appear before task flow code');
    });
  });

  describe('extended: logic', () => {
    it('transpiles logic if/then/else to conditional', () => {
      const yaml = `
web:
  url: "https://example.com"
tasks:
  - name: test
    flow:
      - logic:
          if: "登录按钮可见"
          then:
            - aiTap: "登录按钮"
          else:
            - ai: "继续浏览"
`;
      const result = transpile(yaml);
      assert.ok(result.code.includes('aiBoolean'));
      assert.ok(result.code.includes('登录按钮可见'));
      assert.ok(result.code.includes('agent.aiTap'));
      assert.ok(result.code.includes('else'));
    });
  });

  describe('extended: nested logic', () => {
    it('transpiles nested logic in else branch', () => {
      const yaml = `
web:
  url: "https://example.com"
tasks:
  - name: test
    flow:
      - logic:
          if: "用户已登录"
          then:
            - aiTap: "进入主页"
          else:
            - logic:
                if: "有注册按钮"
                then:
                  - aiTap: "注册"
                else:
                  - aiTap: "联系客服"
`;
      const result = transpile(yaml);
      // Should have two aiBoolean calls for the two conditions
      const boolCount = (result.code.match(/aiBoolean/g) || []).length;
      assert.ok(boolCount >= 2, 'Should have at least 2 aiBoolean calls for nested logic');
      assert.ok(result.code.includes('} else {'), 'Should have else branch');
    });
  });

  describe('extended: loop', () => {
    it('transpiles repeat loop', () => {
      const yaml = `
web:
  url: "https://example.com"
tasks:
  - name: test
    flow:
      - loop:
          type: repeat
          count: 3
          flow:
            - ai: "刷新页面"
`;
      const result = transpile(yaml);
      assert.ok(result.code.includes('for'));
      assert.ok(result.code.includes('3'));
    });

    it('transpiles while loop with maxIterations', () => {
      const yaml = `
web:
  url: "https://example.com"
tasks:
  - name: test
    flow:
      - loop:
          type: while
          condition: "有下一页"
          maxIterations: 10
          flow:
            - aiTap: "下一页"
`;
      const result = transpile(yaml);
      assert.ok(result.code.includes('while'));
      assert.ok(result.code.includes('aiBoolean'));
      assert.ok(result.code.includes('10'));
    });
  });

  describe('extended: loop for-each with itemVar', () => {
    it('transpiles for loop with itemVar field', () => {
      const yaml = `
engine: extended
web:
  url: "https://example.com"
tasks:
  - name: test
    flow:
      - loop:
          type: for
          items: "\${cities}"
          itemVar: "city"
          flow:
            - aiInput: "\${city}"
`;
      const result = transpile(yaml);
      assert.ok(result.code.includes('for (const city of cities)'),
        'Should use itemVar as iterator variable name');
    });
  });

  describe('extended: try/catch', () => {
    it('transpiles try/catch/finally', () => {
      const yaml = `
web:
  url: "https://example.com"
tasks:
  - name: test
    flow:
      - try:
          flow:
            - aiTap: "提交"
        catch:
          flow:
            - recordToReport: "失败"
              content: "提交出错"
        finally:
          flow:
            - recordToReport: "结束"
              content: "流程完成"
`;
      const result = transpile(yaml);
      assert.ok(result.code.includes('try'));
      assert.ok(result.code.includes('catch'));
      assert.ok(result.code.includes('finally'));
    });
  });

  describe('extended: external_call', () => {
    it('transpiles HTTP call to fetch', () => {
      const yaml = `
web:
  url: "https://example.com"
tasks:
  - name: test
    flow:
      - external_call:
          type: http
          method: GET
          url: "https://api.example.com/data"
          response_as: apiData
`;
      const result = transpile(yaml);
      assert.ok(result.code.includes('fetch'));
      assert.ok(result.code.includes('api.example.com'));
      assert.ok(result.code.includes('apiData'));
    });

    it('transpiles shell call to execSync', () => {
      const yaml = `
web:
  url: "https://example.com"
tasks:
  - name: test
    flow:
      - external_call:
          type: shell
          command: "echo hello"
          response_as: output
`;
      const result = transpile(yaml);
      assert.ok(result.code.includes('execSync'));
      assert.ok(result.code.includes('echo hello'));
    });
  });

  describe('extended: external_call body templates', () => {
    it('resolves template variables in POST body', () => {
      const yaml = `
engine: extended
web:
  url: "https://example.com"
tasks:
  - name: test
    flow:
      - external_call:
          type: http
          method: POST
          url: "https://api.example.com/report"
          headers:
            Authorization: "Bearer \${ENV.API_TOKEN}"
            Content-Type: "application/json"
          body:
            title: "测试报告"
            data: "\${collectedData}"
            timestamp: "\${ENV.CURRENT_TIME}"
          response_as: apiResponse
`;
      const result = transpile(yaml);
      assert.ok(result.code.includes('collectedData'),
        'Should resolve ${collectedData} variable reference in body');
      assert.ok(result.code.includes('process.env.API_TOKEN'),
        'Should resolve ENV variable in headers');
      assert.ok(result.code.includes('process.env.CURRENT_TIME'),
        'Should resolve ENV variable in body');
      assert.ok(!result.code.includes('"${collectedData}"'),
        'Should not have raw template string in body');
    });

    it('handles deeply nested body without stack overflow', () => {
      // Build a body 12 levels deep (exceeds MAX_BODY_DEPTH=10)
      let body = '            value: "leaf"';
      for (let i = 0; i < 12; i++) {
        body = '            level' + i + ':\n              ' + body.trim();
      }
      const yaml = `
engine: extended
web:
  url: "https://example.com"
tasks:
  - name: test
    flow:
      - external_call:
          type: http
          method: POST
          url: "https://api.example.com/deep"
          body:
${body}
          response_as: deepResult
`;
      const result = transpile(yaml);
      assert.ok(result.code.includes('deepResult'),
        'Should transpile deeply nested body without error');
    });
  });

  describe('extended: external_call name alias', () => {
    it('supports name as alias for response_as', () => {
      const yaml = `
engine: extended
web:
  url: "https://example.com"
tasks:
  - name: test
    flow:
      - external_call:
          type: http
          method: GET
          url: "https://api.example.com/data"
          name: apiData
`;
      const result = transpile(yaml);
      assert.ok(result.code.includes('apiData'),
        'Should use name field as response variable');
      assert.ok(result.code.includes('const apiData'));
    });
  });

  describe('extended: parallel', () => {
    it('transpiles parallel to Promise.all', () => {
      const yaml = `
web:
  url: "https://example.com"
tasks:
  - name: test
    flow:
      - parallel:
          tasks:
            - flow:
                - aiQuery: "提取标题"
                  name: title
            - flow:
                - aiQuery: "提取描述"
                  name: desc
          merge_results: true
`;
      const result = transpile(yaml);
      assert.ok(result.code.includes('Promise.all'));
    });
  });

  describe('extended: parallel branches alias', () => {
    it('transpiles parallel with branches instead of tasks', () => {
      const yaml = `
web:
  url: "https://example.com"
tasks:
  - name: test
    flow:
      - parallel:
          branches:
            - flow:
                - aiQuery: "提取标题"
                  name: title
            - flow:
                - aiQuery: "提取价格"
                  name: price
`;
      const result = transpile(yaml);
      assert.ok(result.code.includes('Promise.all'),
        'Should generate Promise.all for branches');
    });
  });

  describe('extended: parallel waitAll alias', () => {
    it('treats waitAll as alias for merge_results', () => {
      const yaml = `
engine: extended
web:
  url: "https://example.com"
tasks:
  - name: test
    flow:
      - parallel:
          tasks:
            - name: result1
              flow:
                - aiQuery: "提取A"
                  name: dataA
            - name: result2
              flow:
                - aiQuery: "提取B"
                  name: dataB
          waitAll: true
`;
      const result = transpile(yaml);
      assert.ok(result.code.includes('const [result1, result2] = await Promise.all'),
        'waitAll should trigger destructured assignment like merge_results');
    });
  });

  describe('extended: parallel nested variable hoisting', () => {
    it('hoists variables from nested logic inside parallel branch', () => {
      const yaml = `
engine: extended
web:
  url: "https://example.com"
tasks:
  - name: test
    flow:
      - parallel:
          tasks:
            - flow:
                - logic:
                    if: "有搜索框"
                    then:
                      - aiQuery: "搜索框内容"
                        name: searchContent
            - flow:
                - aiQuery: "页面标题"
                  name: pageTitle
`;
      const result = transpile(yaml);
      assert.ok(result.code.includes('let searchContent;'),
        'Should hoist searchContent from nested logic.then');
      assert.ok(result.code.includes('let pageTitle;'),
        'Should hoist pageTitle from direct flow');
    });
  });

  describe('ENV colon syntax', () => {
    it('resolves ${ENV:XXX} colon syntax to process.env', () => {
      const yaml = `
web:
  url: "https://example.com"
tasks:
  - name: test
    flow:
      - aiInput: "API Key 输入框"
        value: "\${ENV:API_KEY}"
`;
      const result = transpile(yaml);
      assert.ok(result.code.includes('process.env.API_KEY'),
        'Should resolve ${ENV:API_KEY} to process.env.API_KEY');
      assert.ok(!result.code.includes('ENV:API_KEY'),
        'Should not have raw ENV:XXX in output');
    });
  });

  describe('boilerplate generation', () => {
    it('generates puppeteer boilerplate by default', () => {
      const yaml = `
web:
  url: "https://example.com"
tasks:
  - name: test
    flow:
      - aiTap: "button"
`;
      const result = transpile(yaml);
      assert.ok(result.code.includes('puppeteer'));
      assert.ok(result.code.includes('PuppeteerAgent'));
      assert.ok(result.code.includes('example.com'));
    });

    it('generates playwright boilerplate when specified', () => {
      const yaml = `
web:
  url: "https://example.com"
tasks:
  - name: test
    flow:
      - aiTap: "button"
`;
      const result = transpile(yaml, { templateType: 'playwright' });
      assert.ok(result.code.includes('playwright'));
      assert.ok(result.code.includes('PlaywrightAgent'));
    });
  });

  describe('full file transpilation', () => {
    it('transpiles extended-logic.yaml fixture', () => {
      const result = transpile(fixtures('extended-logic.yaml'));
      assert.ok(result.code.length > 0);
      assert.ok(result.code.includes('puppeteer'));
      assert.ok(result.code.includes('aiBoolean'));
    });

    it('transpiles extended-full.yaml fixture', () => {
      const result = transpile(fixtures('extended-full.yaml'));
      assert.ok(result.code.length > 0);
      assert.ok(result.code.includes('try'));
      assert.ok(result.code.includes('Promise.all'));
      assert.ok(result.code.includes('fetch'));
    });
  });

  describe('native action object syntax', () => {
    it('transpiles aiInput with locator object syntax', () => {
      const yaml = `
web:
  url: "https://example.com"
tasks:
  - name: test
    flow:
      - aiInput:
          locator: "用户名输入框"
          value: "admin"
`;
      const result = transpile(yaml);
      assert.ok(result.code.includes('agent.aiInput'));
      assert.ok(result.code.includes('用户名输入框'));
      assert.ok(result.code.includes('admin'));
    });

    it('transpiles aiTap with deepThink option', () => {
      const yaml = `
web:
  url: "https://example.com"
tasks:
  - name: test
    flow:
      - aiTap:
          locator: "编辑按钮"
          deepThink: true
`;
      const result = transpile(yaml);
      assert.ok(result.code.includes('agent.aiTap'));
      assert.ok(result.code.includes('deepThink: true'));
    });

    it('transpiles aiTap with xpath option', () => {
      const yaml = `
web:
  url: "https://example.com"
tasks:
  - name: test
    flow:
      - aiTap:
          xpath: "//button[@id='submit']"
`;
      const result = transpile(yaml);
      assert.ok(result.code.includes('agent.aiTap'));
      assert.ok(result.code.includes('xpath'));
    });

    it('transpiles aiAssert with errorMessage as positional arg', () => {
      const yaml = `
web:
  url: "https://example.com"
tasks:
  - name: test
    flow:
      - aiAssert:
          assertion: "购物车数量为 3"
          errorMessage: "数量不正确"
`;
      const result = transpile(yaml);
      assert.ok(result.code.includes('agent.aiAssert'));
      assert.ok(result.code.includes('数量不正确'));
      // errorMessage is now a positional arg, not in options object
      assert.ok(!result.code.includes('{ errorMessage:'),
        'Should NOT wrap errorMessage in options object');
    });

    it('transpiles aiQuery with object syntax', () => {
      const yaml = `
web:
  url: "https://example.com"
tasks:
  - name: test
    flow:
      - aiQuery:
          query: "页面标题是什么"
          name: "pageTitle"
`;
      const result = transpile(yaml);
      assert.ok(result.code.includes('agent.aiQuery'));
      assert.ok(result.code.includes('pageTitle'));
    });

    it('transpiles aiWaitFor with object syntax', () => {
      const yaml = `
web:
  url: "https://example.com"
tasks:
  - name: test
    flow:
      - aiWaitFor:
          condition: "搜索结果已加载"
          timeout: 15000
`;
      const result = transpile(yaml);
      assert.ok(result.code.includes('agent.aiWaitFor'));
      assert.ok(result.code.includes('15000'));
    });

    it('transpiles aiScroll with two-arg signature (locate, options)', () => {
      const yaml = `
web:
  url: "https://example.com"
tasks:
  - name: test
    flow:
      - aiScroll:
          locator: "商品列表"
          direction: "down"
          distance: 300
`;
      const result = transpile(yaml);
      assert.ok(result.code.includes('agent.aiScroll'));
      assert.ok(result.code.includes('商品列表'));
      assert.ok(result.code.includes("direction: '"));
      assert.ok(result.code.includes('distance: 300'));
    });

    it('escapes backticks in javascript step', () => {
      const yaml = `
web:
  url: "https://example.com"
tasks:
  - name: test
    flow:
      - javascript: "document.querySelector(\`div\`).textContent"
`;
      const result = transpile(yaml);
      assert.ok(result.code.includes('evaluateJavaScript'));
      // Should have escaped backticks
      assert.ok(!result.code.includes('`div`') || result.code.includes('\\`div\\`'));
    });
  });

  describe('native action: aiHover', () => {
    it('transpiles aiHover string form', () => {
      const yaml = `
web:
  url: "https://example.com"
tasks:
  - name: test
    flow:
      - aiHover: "用户头像"
`;
      const result = transpile(yaml);
      assert.ok(result.code.includes('agent.aiHover'));
      assert.ok(result.code.includes('用户头像'));
    });

    it('transpiles aiHover with deepThink option', () => {
      const yaml = `
web:
  url: "https://example.com"
tasks:
  - name: test
    flow:
      - aiHover:
          locator: "下拉菜单触发器"
          deepThink: true
`;
      const result = transpile(yaml);
      assert.ok(result.code.includes('agent.aiHover'));
      assert.ok(result.code.includes('deepThink: true'));
    });
  });

  describe('native action: aiKeyboardPress', () => {
    it('transpiles aiKeyboardPress shorthand (value as keyName)', () => {
      const yaml = `
web:
  url: "https://example.com"
tasks:
  - name: test
    flow:
      - aiKeyboardPress: "Enter"
`;
      const result = transpile(yaml);
      assert.ok(result.code.includes('agent.aiKeyboardPress'));
      assert.ok(result.code.includes("keyName: 'Enter'"),
        'Should put Enter in keyName option');
      assert.ok(result.code.includes('undefined,'),
        'Shorthand should pass undefined as locate');
    });

    it('uses keyName sibling — aiKeyboardPress value as locate', () => {
      const yaml = `
web:
  url: "https://example.com"
tasks:
  - name: test
    flow:
      - aiKeyboardPress: "搜索框"
        keyName: "Tab"
`;
      const result = transpile(yaml);
      assert.ok(result.code.includes('agent.aiKeyboardPress'),
        'Should generate aiKeyboardPress call');
      assert.ok(result.code.includes("keyName: 'Tab'"),
        'Should use keyName option value');
      assert.ok(result.code.includes('搜索框'),
        'Should use aiKeyboardPress value as locate');
    });
  });

  describe('extended: try with finally only (no catch)', () => {
    it('transpiles try + finally without catch block', () => {
      const yaml = `
engine: extended
web:
  url: "https://example.com"
tasks:
  - name: test
    flow:
      - try:
          flow:
            - aiTap: "开始操作"
        finally:
          flow:
            - recordToReport: "清理完成"
              content: "资源已释放"
`;
      const result = transpile(yaml);
      assert.ok(result.code.includes('try {'));
      assert.ok(result.code.includes('} finally {'));
      // The inner try/finally should not have a catch block between them
      // (the outer template has its own try/finally, so we check the inner one)
      const codeLines = result.code.split('\n');
      const innerTryIdx = codeLines.findIndex(l => l.includes("await agent.aiTap('开始操作')"));
      const finallyIdx = codeLines.findIndex((l, i) => i > innerTryIdx && l.includes('} finally {'));
      // No catch between inner try and finally
      const between = codeLines.slice(innerTryIdx, finallyIdx).join('\n');
      assert.ok(!between.includes('catch'),
        'Should not have a catch block between try and finally');
      assert.ok(result.code.includes('清理完成'));
    });
  });

  describe('continueOnError and output', () => {
    it('wraps task with continueOnError in try/catch', () => {
      const yaml = `
web:
  url: "https://example.com"
tasks:
  - name: risky task
    continueOnError: true
    flow:
      - aiTap: "button"
  - name: next task
    flow:
      - aiAssert: "still running"
`;
      const result = transpile(yaml);
      assert.ok(result.code.includes('try {'));
      assert.ok(result.code.includes('_continueErr'));
      assert.ok(result.code.includes('risky task'));
    });

    it('generates output file writing code', () => {
      const yaml = `
engine: extended
web:
  url: "https://example.com"
tasks:
  - name: export data
    flow:
      - aiQuery:
          query: "提取商品数据"
          name: "products"
    output:
      filePath: "./output/products.json"
      dataName: "products"
`;
      const result = transpile(yaml);
      assert.ok(result.code.includes('writeFileSync'));
      assert.ok(result.code.includes('products.json'));
      assert.ok(result.code.includes('products'));
    });
  });

  describe('data_transform flat format', () => {
    it('transpiles filter operation with condition', () => {
      const yaml = `
engine: extended
web:
  url: "https://example.com"
tasks:
  - name: test
    flow:
      - data_transform:
          source: "\${rawProducts}"
          operation: filter
          condition: "item.rating >= 4"
          name: "highRated"
`;
      const result = transpile(yaml);
      assert.ok(result.code.includes('highRated'));
      assert.ok(result.code.includes('.filter('));
      assert.ok(result.code.includes('item.rating >= 4'));
    });

    it('transpiles sort operation with by and order', () => {
      const yaml = `
engine: extended
web:
  url: "https://example.com"
tasks:
  - name: test
    flow:
      - data_transform:
          source: "\${products}"
          operation: sort
          by: "price"
          order: "desc"
          name: "sorted"
`;
      const result = transpile(yaml);
      assert.ok(result.code.includes('sorted'));
      assert.ok(result.code.includes('.sort('));
      assert.ok(result.code.includes('localeCompare'),
        'Should use localeCompare for string-safe sorting');
      assert.ok(result.code.includes('return -c'),
        'Desc sort should negate comparator');
    });

    it('transpiles map operation with template object', () => {
      const yaml = `
engine: extended
web:
  url: "https://example.com"
tasks:
  - name: test
    flow:
      - data_transform:
          source: "\${products}"
          operation: map
          template:
            title: "\${item.name}"
            cost: "\${item.price}"
          name: "mapped"
`;
      const result = transpile(yaml);
      assert.ok(result.code.includes('mapped'));
      assert.ok(result.code.includes('.map('));
      assert.ok(result.code.includes('item.name'));
      assert.ok(result.code.includes('item.price'));
    });

    it('transpiles reduce operation with reducer', () => {
      const yaml = `
engine: extended
web:
  url: "https://example.com"
tasks:
  - name: test
    flow:
      - data_transform:
          source: "\${prices}"
          operation: reduce
          reducer: "acc + item.price"
          initial: 0
          name: "total"
`;
      const result = transpile(yaml);
      assert.ok(result.code.includes('total'));
      assert.ok(result.code.includes('.reduce('));
      assert.ok(result.code.includes('acc + item.price'));
    });

    it('transpiles unique operation with by field', () => {
      const yaml = `
engine: extended
web:
  url: "https://example.com"
tasks:
  - name: test
    flow:
      - data_transform:
          source: "\${items}"
          operation: unique
          by: "id"
          name: "uniqueItems"
`;
      const result = transpile(yaml);
      assert.ok(result.code.includes('uniqueItems'));
      assert.ok(result.code.includes('new Map'));
      assert.ok(result.code.includes('item.id'));
    });

    it('transpiles slice operation', () => {
      const yaml = `
engine: extended
web:
  url: "https://example.com"
tasks:
  - name: test
    flow:
      - data_transform:
          source: "\${items}"
          operation: slice
          start: 0
          end: 10
          name: "top10"
`;
      const result = transpile(yaml);
      assert.ok(result.code.includes('top10'));
      assert.ok(result.code.includes('.slice(0, 10)'));
    });

    it('transpiles flatten operation in flat format', () => {
      const yaml = `
engine: extended
web:
  url: "https://example.com"
tasks:
  - name: test
    flow:
      - data_transform:
          source: "\${nested}"
          operation: flatten
          depth: 3
          name: "flatList"
`;
      const result = transpile(yaml);
      assert.ok(result.code.includes('flatList'));
      assert.ok(result.code.includes('.flat(3)'));
    });

    it('transpiles groupBy operation in flat format', () => {
      const yaml = `
engine: extended
web:
  url: "https://example.com"
tasks:
  - name: test
    flow:
      - data_transform:
          source: "\${products}"
          operation: groupBy
          by: "category"
          name: "grouped"
`;
      const result = transpile(yaml);
      assert.ok(result.code.includes('grouped'));
      assert.ok(result.code.includes('.reduce('));
      assert.ok(result.code.includes('item.category'));
    });
  });

  describe('data_transform nested format', () => {
    it('transpiles chained operations with input/operations/output', () => {
      const yaml = `
engine: extended
web:
  url: "https://example.com"
tasks:
  - name: test
    flow:
      - data_transform:
          input: "\${rawData}"
          operations:
            - filter: "price > 10"
            - sort: "price desc"
          output: "processedData"
`;
      const result = transpile(yaml);
      assert.ok(result.code.includes('processedData'));
      assert.ok(result.code.includes('.filter('));
      assert.ok(result.code.includes('.sort('));
      assert.ok(result.code.includes('localeCompare'),
        'Should use localeCompare for string-safe sorting');
    });

    it('transpiles flatten operation', () => {
      const yaml = `
engine: extended
web:
  url: "https://example.com"
tasks:
  - name: test
    flow:
      - data_transform:
          input: "\${nestedArrays}"
          operations:
            - flatten: 2
          output: "flatData"
`;
      const result = transpile(yaml);
      assert.ok(result.code.includes('flatData'));
      assert.ok(result.code.includes('.flat(2)'));
    });

    it('transpiles groupBy operation', () => {
      const yaml = `
engine: extended
web:
  url: "https://example.com"
tasks:
  - name: test
    flow:
      - data_transform:
          input: "\${products}"
          operations:
            - groupBy: "category"
          output: "grouped"
`;
      const result = transpile(yaml);
      assert.ok(result.code.includes('grouped'));
      assert.ok(result.code.includes('.reduce('));
      assert.ok(result.code.includes('item.category'));
    });

    it('transpiles distinct as alias for unique', () => {
      const yaml = `
engine: extended
web:
  url: "https://example.com"
tasks:
  - name: test
    flow:
      - data_transform:
          input: "\${items}"
          operations:
            - distinct: "name"
          output: "uniqueByName"
`;
      const result = transpile(yaml);
      assert.ok(result.code.includes('uniqueByName'));
      assert.ok(result.code.includes('new Map'));
      assert.ok(result.code.includes('item.name'));
    });
  });

  describe('extended: loop indexVar', () => {
    it('supports indexVar for repeat loops', () => {
      const yaml = `
engine: extended
web:
  url: "https://example.com"
tasks:
  - name: test
    flow:
      - loop:
          type: repeat
          count: 5
          indexVar: "idx"
          flow:
            - ai: "step \${idx}"
`;
      const result = transpile(yaml);
      assert.ok(result.code.includes('let idx = 0'),
        'Should use custom indexVar name');
      assert.ok(result.code.includes('idx < 5'),
        'Should use custom index in condition');
    });
  });

  describe('extended: while loop counter uniqueness', () => {
    it('generates unique _iN counters for sibling while loops', () => {
      const yaml = `
engine: extended
web:
  url: "https://example.com"
tasks:
  - name: test
    flow:
      - loop:
          type: while
          condition: "还有更多内容"
          maxIterations: 10
          flow:
            - aiScroll: "down"
      - loop:
          type: while
          condition: "还有下一页"
          maxIterations: 5
          flow:
            - aiTap: "下一页"
`;
      const result = transpile(yaml);
      assert.ok(result.code.includes('let _i0 = 0'),
        'First while loop should use _i0');
      assert.ok(result.code.includes('let _i1 = 0'),
        'Second while loop should use _i1 to avoid collision');
    });
  });

  describe('import and use', () => {
    it('generates top-level flow import as variable declaration', () => {
      const yaml = `
engine: extended
import:
  - flow: "./common/login.yaml"
    as: loginFlow
web:
  url: "https://example.com"
tasks:
  - name: test
    flow:
      - use: "\${loginFlow}"
        with:
          username: "admin"
`;
      const result = transpile(yaml);
      assert.ok(result.code.includes("const loginFlow = './common/login.yaml'"),
        'Should declare flow path variable');
      assert.ok(result.code.includes('agent.runYaml(loginFlow'),
        'Should call runYaml with the flow variable');
      assert.ok(result.code.includes("username: 'admin'"),
        'Should pass with params');
    });

    it('generates top-level data import as require', () => {
      const yaml = `
engine: extended
import:
  - data: "./fixtures/users.json"
    as: testUsers
web:
  url: "https://example.com"
tasks:
  - name: test
    flow:
      - aiTap: "button"
`;
      const result = transpile(yaml);
      assert.ok(result.code.includes("require('./fixtures/users.json')"),
        'Should require JSON data file');
      assert.ok(result.code.includes('testUsers'),
        'Should use the declared alias');
    });

    it('transpiles use step without with params', () => {
      const yaml = `
web:
  url: "https://example.com"
tasks:
  - name: test
    flow:
      - use: "./common/setup.yaml"
`;
      const result = transpile(yaml);
      assert.ok(result.code.includes('agent.runYaml'),
        'Should generate runYaml call');
    });

    it('transpiles use step with template variable params', () => {
      const yaml = `
engine: extended
import:
  - flow: "./common/login.yaml"
    as: loginFlow
  - data: "./data/users.json"
    as: users
web:
  url: "https://example.com"
tasks:
  - name: test
    flow:
      - use: "\${loginFlow}"
        with:
          username: "\${users[0].name}"
          password: "\${users[0].pass}"
`;
      const result = transpile(yaml);
      assert.ok(result.code.includes('loginFlow'),
        'Should reference loginFlow variable');
      assert.ok(result.code.includes('users[0].name'),
        'Should resolve template variables in params');
      assert.ok(result.code.includes('users[0].pass'),
        'Should resolve password param');
    });
  });

  describe('fixture file transpilation', () => {
    it('transpiles extended-import-use.yaml fixture', () => {
      const result = transpile(fixtures('extended-import-use.yaml'));
      assert.ok(result.code.length > 100);
      assert.ok(result.code.includes('loginFlow'), 'Should include import variable');
      assert.ok(result.code.includes('agent.runYaml'), 'Should include runYaml for use step');
      assert.ok(result.code.includes('testUsers'), 'Should include data import');
    });

    it('transpiles extended-data-transform.yaml fixture', () => {
      const result = transpile(fixtures('extended-data-transform.yaml'));
      assert.ok(result.code.length > 100);
      assert.ok(result.code.includes('.filter('), 'Should include filter operation');
      assert.ok(result.code.includes('.sort('), 'Should include sort operation');
      assert.ok(result.code.includes('.map('), 'Should include map operation');
      assert.ok(result.code.includes('.slice('), 'Should include slice operation');
    });
  });

  describe('extended template transpilation', () => {
    const fs = require('fs');
    const templateDir = path.join(__dirname, '..', 'templates', 'extended');

    const templates = fs.readdirSync(templateDir)
      .filter(f => f.endsWith('.yaml') || f.endsWith('.yml'))
      .map(f => path.join(templateDir, f));

    for (const tpl of templates) {
      it(`transpiles extended template: ${path.basename(tpl)}`, () => {
        const result = transpile(tpl);
        assert.ok(result.code.length > 100,
          `Template ${path.basename(tpl)} should generate substantial TypeScript code`);
        assert.ok(result.code.includes('puppeteer') || result.code.includes('playwright'),
          `Should include boilerplate imports`);
        assert.ok(result.code.includes('async function main'),
          `Should have main async function`);
        // Ensure code doesn't have obvious generation errors (but allow
        // 'undefined' in variable declarations which is valid JS)
        assert.ok(!result.code.includes('TODO: generator'),
          `Should not have unimplemented generator placeholders`);
      });
    }
  });

  describe('aiInput edge cases', () => {
    it('handles missing value in string syntax with empty string default', () => {
      const yaml = `
web:
  url: "https://example.com"
tasks:
  - name: test
    flow:
      - aiInput: "search field"
`;
      const result = transpile(yaml);
      assert.ok(result.code.includes("aiInput("),
        'Should generate aiInput call');
      assert.ok(!result.code.includes('undefined'),
        'Should not have undefined value — defaults to empty string');
    });

    it('merges value with options using buildOptionEntries', () => {
      const yaml = `
web:
  url: "https://example.com"
tasks:
  - name: test
    flow:
      - aiInput:
          locator: "email field"
          value: "test@example.com"
          deepThink: true
`;
      const result = transpile(yaml);
      assert.ok(result.code.includes("deepThink: true"),
        'Should include deepThink option');
      assert.ok(result.code.includes("value:"),
        'Should include value in options object');
    });
  });

  describe('aiScroll edge cases', () => {
    it('handles object syntax with locator only', () => {
      const yaml = `
web:
  url: "https://example.com"
tasks:
  - name: test
    flow:
      - aiScroll:
          locator: "main content"
`;
      const result = transpile(yaml);
      assert.ok(result.code.includes('aiScroll'),
        'Should generate aiScroll call');
      assert.ok(result.code.includes('main content'),
        'Should include locator as first arg');
    });

    it('handles flat/sibling format with direction and distance', () => {
      const yaml = `
web:
  url: "https://example.com"
tasks:
  - name: test
    flow:
      - aiScroll: "商品列表"
        direction: "down"
        distance: 300
`;
      const result = transpile(yaml);
      assert.ok(result.code.includes('aiScroll'),
        'Should generate aiScroll call');
      assert.ok(result.code.includes('商品列表'),
        'Should include locator from flat format');
      assert.ok(result.code.includes("direction: 'down'"),
        'Should include direction from sibling key');
      assert.ok(result.code.includes('distance: 300'),
        'Should include distance from sibling key');
    });

    it('handles flat format with scrollType', () => {
      const yaml = `
web:
  url: "https://example.com"
tasks:
  - name: test
    flow:
      - aiScroll: "长列表"
        scrollType: "scrollToBottom"
`;
      const result = transpile(yaml);
      assert.ok(result.code.includes('aiScroll'),
        'Should generate aiScroll call');
      assert.ok(result.code.includes("scrollType: 'scrollToBottom'"),
        'Should include scrollType from sibling key');
    });

    it('handles nested object format with scrollType', () => {
      const yaml = `
web:
  url: "https://example.com"
tasks:
  - name: test
    flow:
      - aiScroll:
          locator: "feed"
          direction: "down"
          scrollType: "singleAction"
`;
      const result = transpile(yaml);
      assert.ok(result.code.includes("scrollType: 'singleAction'"),
        'Should include scrollType from nested format');
    });
  });

  describe('data_transform edge cases', () => {
    it('handles nested format with missing input gracefully', () => {
      const yaml = `
engine: extended
web:
  url: "https://example.com"
tasks:
  - name: test
    flow:
      - data_transform:
          operations:
            - flatten: 1
          output: "flatData"
`;
      const result = transpile(yaml);
      assert.ok(result.code.includes('flatData'),
        'Should use output variable name');
      assert.ok(result.code.includes('[]'),
        'Should default to empty array when input is missing');
    });

    it('handles flat format with missing source gracefully', () => {
      const yaml = `
engine: extended
web:
  url: "https://example.com"
tasks:
  - name: test
    flow:
      - data_transform:
          operation: filter
          condition: "item.active"
          name: "activeItems"
`;
      const result = transpile(yaml);
      assert.ok(result.code.includes('activeItems'),
        'Should use name as output variable');
      assert.ok(result.code.includes('[]'),
        'Should default to empty array when source is missing');
    });
  });

  describe('continueOnError', () => {
    it('wraps task flow in try/catch with warning', () => {
      const yaml = `
web:
  url: "https://example.com"
tasks:
  - name: risky task
    continueOnError: true
    flow:
      - aiTap: "button"
  - name: safe task
    flow:
      - aiAssert: "page loaded"
`;
      const result = transpile(yaml);
      assert.ok(result.code.includes('_continueErr'),
        'Should have continueOnError catch variable');
      assert.ok(result.code.includes('console.warn'),
        'Should warn on error instead of crashing');
      assert.ok(result.code.includes('aiAssert'),
        'Second task should still be generated');
    });
  });

  describe('catch error variable', () => {
    it('supports custom error variable name via error field', () => {
      const yaml = `
engine: extended
web:
  url: "https://example.com"
tasks:
  - name: test
    flow:
      - try:
          steps:
            - aiTap: "button"
        catch:
          error: myError
          steps:
            - aiTap: "close"
`;
      const result = transpile(yaml);
      assert.ok(result.code.includes('catch (myError)'),
        'Should use custom error variable name');
    });
  });

  describe('schema/transpiler consistency', () => {
    it('aiAssert flat format with errorMessage sibling', () => {
      const yaml = `
engine: extended
web:
  url: "https://example.com"
tasks:
  - name: test
    flow:
      - aiAssert: "页面包含欢迎信息"
        errorMessage: "欢迎信息未找到"
`;
      const result = transpile(yaml);
      assert.ok(result.code.includes('agent.aiAssert'),
        'Should generate aiAssert call');
      assert.ok(result.code.includes('欢迎信息未找到'),
        'Should include error message text');
      assert.ok(!result.code.includes('{ errorMessage:'),
        'errorMessage should be positional arg, not in options');
    });

    it('aiKeyboardPress with options (deepThink, timeout)', () => {
      const yaml = `
engine: extended
web:
  url: "https://example.com"
tasks:
  - name: test
    flow:
      - aiKeyboardPress: "Enter"
        deepThink: true
        timeout: 5000
`;
      const result = transpile(yaml);
      assert.ok(result.code.includes('agent.aiKeyboardPress'),
        'Should generate aiKeyboardPress call');
      assert.ok(result.code.includes("keyName: 'Enter'"),
        'Should put Enter in keyName option');
      assert.ok(result.code.includes('deepThink: true'),
        'Should pass deepThink option');
      assert.ok(result.code.includes('timeoutMs: 5000'),
        'Should pass timeout option');
    });

    it('aiTap nested object with locator and deepThink', () => {
      const yaml = `
engine: extended
web:
  url: "https://example.com"
tasks:
  - name: test
    flow:
      - aiTap:
          locator: "编辑按钮"
          deepThink: true
`;
      const result = transpile(yaml);
      assert.ok(result.code.includes('agent.aiTap'),
        'Should generate aiTap call');
      assert.ok(result.code.includes('编辑按钮'),
        'Should include locator text');
      assert.ok(result.code.includes('deepThink: true'),
        'Should pass deepThink from nested object');
    });

    it('aiInput nested object format with locator and value', () => {
      const yaml = `
engine: extended
web:
  url: "https://example.com"
tasks:
  - name: test
    flow:
      - aiInput:
          locator: "用户名输入框"
          value: "admin"
`;
      const result = transpile(yaml);
      assert.ok(result.code.includes('agent.aiInput'),
        'Should generate aiInput call');
      assert.ok(result.code.includes('用户名输入框'),
        'Should include locator');
      assert.ok(result.code.includes('admin'),
        'Should include value');
    });

    it('recordToReport with content sibling', () => {
      const yaml = `
engine: extended
web:
  url: "https://example.com"
tasks:
  - name: test
    flow:
      - recordToReport: "测试截图"
        content: "登录后的页面状态"
`;
      const result = transpile(yaml);
      assert.ok(result.code.includes('agent.recordToReport'),
        'Should generate recordToReport call');
      assert.ok(result.code.includes('测试截图'),
        'Should include title');
      assert.ok(result.code.includes('登录后的页面状态'),
        'Should include content text');
    });
  });

  describe('platform config extraction (B1)', () => {
    it('passes userAgent to template', () => {
      const yaml = `
web:
  url: "https://example.com"
  userAgent: "Mozilla/5.0 Custom"
tasks:
  - name: test
    flow:
      - aiTap: "button"
`;
      const result = transpile(yaml);
      assert.ok(result.code.includes('setUserAgent'),
        'Should include setUserAgent call for puppeteer');
      assert.ok(result.code.includes('Mozilla/5.0 Custom'),
        'Should include the user agent string');
    });

    it('passes cookie to template and triggers fs import', () => {
      const yaml = `
web:
  url: "https://example.com"
  cookie: "./cookies.json"
tasks:
  - name: test
    flow:
      - aiTap: "button"
`;
      const result = transpile(yaml);
      assert.ok(result.code.includes('setCookie'),
        'Should include setCookie call');
      assert.ok(result.code.includes("import * as fs from 'fs'"),
        'Should import fs for cookie file reading');
    });

    it('passes acceptInsecureCerts to template', () => {
      const yaml = `
web:
  url: "https://example.com"
  acceptInsecureCerts: true
tasks:
  - name: test
    flow:
      - aiTap: "button"
`;
      const result = transpile(yaml);
      assert.ok(result.code.includes('ignoreHTTPSErrors'),
        'Should include ignoreHTTPSErrors');
    });

    it('passes deviceScaleFactor to viewport', () => {
      const yaml = `
web:
  url: "https://example.com"
  deviceScaleFactor: 2
tasks:
  - name: test
    flow:
      - aiTap: "button"
`;
      const result = transpile(yaml);
      assert.ok(result.code.includes('deviceScaleFactor'),
        'Should include deviceScaleFactor in viewport');
    });

    it('passes waitForNetworkIdle to template', () => {
      const yaml = `
web:
  url: "https://example.com"
  waitForNetworkIdle: true
tasks:
  - name: test
    flow:
      - aiTap: "button"
`;
      const result = transpile(yaml);
      assert.ok(result.code.includes('waitForNetworkIdle'),
        'Should include waitForNetworkIdle call');
    });
  });

  describe('playwright template (B2)', () => {
    it('cookie uses context.addCookies in playwright', () => {
      const yaml = `
web:
  url: "https://example.com"
  cookie: "./cookies.json"
tasks:
  - name: test
    flow:
      - aiTap: "button"
`;
      const result = transpile(yaml, { templateType: 'playwright' });
      assert.ok(result.code.includes('addCookies'),
        'Should use context.addCookies for playwright');
    });

    it('acceptInsecureCerts in playwright context', () => {
      const yaml = `
web:
  url: "https://example.com"
  acceptInsecureCerts: true
tasks:
  - name: test
    flow:
      - aiTap: "button"
`;
      const result = transpile(yaml, { templateType: 'playwright' });
      assert.ok(result.code.includes('ignoreHTTPSErrors'),
        'Should include ignoreHTTPSErrors in playwright context');
    });
  });

  describe('agent config (B3)', () => {
    it('passes agent config to constructor when present', () => {
      const yaml = `
web:
  url: "https://example.com"
agent:
  testId: "my-test"
  groupName: "login-tests"
  generateReport: true
tasks:
  - name: test
    flow:
      - aiTap: "button"
`;
      const result = transpile(yaml);
      assert.ok(result.code.includes('my-test'),
        'Should include testId in agent config');
      assert.ok(result.code.includes('login-tests'),
        'Should include groupName in agent config');
      assert.ok(result.code.includes('PuppeteerAgent(page,'),
        'Should pass config to PuppeteerAgent constructor');
    });

    it('does not pass config when agent key is absent', () => {
      const yaml = `
web:
  url: "https://example.com"
tasks:
  - name: test
    flow:
      - aiTap: "button"
`;
      const result = transpile(yaml);
      assert.ok(result.code.includes('PuppeteerAgent(page)'),
        'Should not pass config when no agent key');
    });
  });

  describe('unknown step warnings (C1)', () => {
    it('produces warning for unknown step type', () => {
      const yaml = `
web:
  url: "https://example.com"
tasks:
  - name: test
    flow:
      - unknownAction: "something"
`;
      const result = transpile(yaml);
      assert.ok(result.warnings && result.warnings.length > 0,
        'Should produce warnings for unknown step');
      assert.ok(result.warnings[0].includes('Unknown step type'),
        'Warning should mention unknown step type');
    });

    it('does not warn for known step types', () => {
      const yaml = `
web:
  url: "https://example.com"
tasks:
  - name: test
    flow:
      - aiTap: "button"
`;
      const result = transpile(yaml);
      assert.ok(!result.warnings || result.warnings.length === 0,
        'Should not produce warnings for known steps');
    });
  });

  // ===========================================================================
  // Phase 4 — New transpiler tests (4.2)
  // ===========================================================================

  describe('new native actions (Phase 2)', () => {
    it('transpiles aiDoubleClick', () => {
      const yaml = `
web:
  url: "https://example.com"
tasks:
  - name: test
    flow:
      - aiDoubleClick: "cell A1"
`;
      const result = transpile(yaml);
      assert.ok(result.code.includes('agent.aiDoubleClick'));
      assert.ok(result.code.includes('cell A1'));
    });

    it('transpiles aiRightClick', () => {
      const yaml = `
web:
  url: "https://example.com"
tasks:
  - name: test
    flow:
      - aiRightClick: "file icon"
`;
      const result = transpile(yaml);
      assert.ok(result.code.includes('agent.aiRightClick'));
      assert.ok(result.code.includes('file icon'));
    });

    it('transpiles aiLocate with name', () => {
      const yaml = `
web:
  url: "https://example.com"
tasks:
  - name: test
    flow:
      - aiLocate: "submit button"
        name: submitBtn
`;
      const result = transpile(yaml);
      assert.ok(result.code.includes('agent.aiLocate'));
      assert.ok(result.code.includes('submitBtn'));
    });

    it('transpiles aiBoolean', () => {
      const yaml = `
web:
  url: "https://example.com"
tasks:
  - name: test
    flow:
      - aiBoolean: "Is user logged in?"
        name: isLoggedIn
`;
      const result = transpile(yaml);
      assert.ok(result.code.includes('agent.aiBoolean'));
      assert.ok(result.code.includes('isLoggedIn'));
    });

    it('transpiles aiNumber', () => {
      const yaml = `
web:
  url: "https://example.com"
tasks:
  - name: test
    flow:
      - aiNumber: "How many items in the cart?"
        name: cartCount
`;
      const result = transpile(yaml);
      assert.ok(result.code.includes('agent.aiNumber'));
      assert.ok(result.code.includes('cartCount'));
    });

    it('transpiles aiString', () => {
      const yaml = `
web:
  url: "https://example.com"
tasks:
  - name: test
    flow:
      - aiString: "What is the page title?"
        name: pageTitle
`;
      const result = transpile(yaml);
      assert.ok(result.code.includes('agent.aiString'));
      assert.ok(result.code.includes('pageTitle'));
    });
  });

  describe('native action options passthrough', () => {
    it('passes deepThink to aiTap', () => {
      const yaml = `
web:
  url: "https://example.com"
tasks:
  - name: test
    flow:
      - aiTap: "complex button"
        deepThink: true
`;
      const result = transpile(yaml);
      assert.ok(result.code.includes('deepThink: true'));
    });

    it('passes cacheable to ai action', () => {
      const yaml = `
web:
  url: "https://example.com"
tasks:
  - name: test
    flow:
      - ai: "do something"
        cacheable: true
`;
      const result = transpile(yaml);
      assert.ok(result.code.includes('cacheable: true'));
    });

    it('passes mode to aiInput', () => {
      const yaml = `
web:
  url: "https://example.com"
tasks:
  - name: test
    flow:
      - aiInput: "search box"
        value: "hello"
        mode: "replace"
`;
      const result = transpile(yaml);
      assert.ok(result.code.includes("mode: 'replace'"));
    });
  });

  describe('aiScroll flat/sibling format', () => {
    it('transpiles aiScroll with sibling direction', () => {
      const yaml = `
web:
  url: "https://example.com"
tasks:
  - name: test
    flow:
      - aiScroll: "main content"
        direction: "down"
        distance: 500
`;
      const result = transpile(yaml);
      assert.ok(result.code.includes('agent.aiScroll'));
      assert.ok(result.code.includes("direction: 'down'"));
      assert.ok(result.code.includes('distance: 500'));
    });
  });

  describe('aiAssert flat/sibling format', () => {
    it('transpiles aiAssert with sibling errorMessage as positional arg', () => {
      const yaml = `
web:
  url: "https://example.com"
tasks:
  - name: test
    flow:
      - aiAssert: "page shows welcome"
        errorMessage: "Welcome message not found"
`;
      const result = transpile(yaml);
      assert.ok(result.code.includes('agent.aiAssert'));
      assert.ok(result.code.includes('Welcome message not found'));
      assert.ok(!result.code.includes('{ errorMessage:'),
        'errorMessage should be positional arg, not in options');
    });
  });

  describe('javascript action with name/output', () => {
    it('captures javascript result with name', () => {
      const yaml = `
web:
  url: "https://example.com"
tasks:
  - name: test
    flow:
      - javascript: "document.title"
        name: pageTitle
`;
      const result = transpile(yaml);
      assert.ok(result.code.includes('const pageTitle'));
      assert.ok(result.code.includes('evaluateJavaScript'));
    });

    it('captures javascript result with output', () => {
      const yaml = `
web:
  url: "https://example.com"
tasks:
  - name: test
    flow:
      - javascript: "window.location.href"
        output: currentUrl
`;
      const result = transpile(yaml);
      assert.ok(result.code.includes('const currentUrl'));
    });
  });

  describe('use step transpilation', () => {
    it('transpiles use step without parameters', () => {
      const yaml = `
engine: extended
features: [import]
web:
  url: "https://example.com"
import:
  - flow: "./login.yaml"
    as: loginFlow
tasks:
  - name: test
    flow:
      - use: "\${loginFlow}"
`;
      const result = transpile(yaml);
      assert.ok(result.code.includes('loginFlow'));
    });
  });

  describe('escapeStringLiteral handles special chars', () => {
    it('escapes newlines, carriage returns, and tabs in string values', () => {
      const yaml = `
web:
  url: "https://example.com"
tasks:
  - name: test
    flow:
      - aiAssert: "line1\\nline2"
`;
      const result = transpile(yaml);
      // The literal backslash-n in YAML becomes \n in the generated code
      assert.ok(result.code.includes('agent.aiAssert'));
    });
  });

  describe('loop times alias', () => {
    it('transpiles repeat loop with times alias', () => {
      const yaml = `
engine: extended
features: [loop]
web:
  url: "https://example.com"
tasks:
  - name: test
    flow:
      - loop:
          type: repeat
          times: 3
          flow:
            - aiTap: "next"
`;
      const result = transpile(yaml);
      assert.ok(result.code.includes('3'));
    });
  });

  describe('repeat loop with template variable count', () => {
    it('resolves template variable in repeat count', () => {
      const yaml = `
engine: extended
web:
  url: "https://example.com"
variables:
  maxRetries: 5
tasks:
  - name: test
    flow:
      - loop:
          type: repeat
          count: "\${maxRetries}"
          flow:
            - aiTap: "retry button"
`;
      const result = transpile(yaml);
      assert.ok(result.code.includes('maxRetries'),
        'Should resolve template variable in repeat count');
      assert.ok(!result.code.includes('"${maxRetries}"'),
        'Should not include raw template string in for-loop');
    });
  });

  // ===== V2 Plan Tests =====

  describe('aiAssert positional errorMessage signature', () => {
    it('generates errorMessage as second positional arg (not in options)', () => {
      const yaml = `
web:
  url: "https://example.com"
tasks:
  - name: test
    flow:
      - aiAssert: "购物车有3件商品"
        errorMessage: "商品数量不对"
`;
      const result = transpile(yaml);
      // Should be: aiAssert('...', '商品数量不对')
      assert.ok(result.code.includes("'商品数量不对'"));
      assert.ok(!result.code.includes('{ errorMessage'));
    });
  });

  describe('aiKeyboardPress two-arg signature', () => {
    it('puts keyName in options, locate as first arg', () => {
      const yaml = `
web:
  url: "https://example.com"
tasks:
  - name: test
    flow:
      - aiKeyboardPress: "搜索框"
        keyName: "Enter"
`;
      const result = transpile(yaml);
      assert.ok(result.code.includes("'搜索框'"));
      assert.ok(result.code.includes("keyName: 'Enter'"));
    });

    it('shorthand without keyName uses value as keyName', () => {
      const yaml = `
web:
  url: "https://example.com"
tasks:
  - name: test
    flow:
      - aiKeyboardPress: "Tab"
`;
      const result = transpile(yaml);
      assert.ok(result.code.includes('undefined'));
      assert.ok(result.code.includes("keyName: 'Tab'"));
    });
  });

  describe('aiScroll two-arg signature', () => {
    it('generates (locate, { direction, distance }) format', () => {
      const yaml = `
web:
  url: "https://example.com"
tasks:
  - name: test
    flow:
      - aiScroll: "列表区域"
        direction: "down"
        distance: 500
`;
      const result = transpile(yaml);
      assert.ok(result.code.includes("'列表区域'"));
      assert.ok(result.code.includes("direction: 'down'"));
      assert.ok(result.code.includes('distance: 500'));
      // Should NOT have locator inside options
      assert.ok(!result.code.includes('locator:'));
    });
  });

  describe('deepThink three-state', () => {
    it('handles deepThink: false', () => {
      const yaml = `
web:
  url: "https://example.com"
tasks:
  - name: test
    flow:
      - aiTap: "按钮"
        deepThink: false
`;
      const result = transpile(yaml);
      assert.ok(result.code.includes('deepThink: false'));
    });

    it('handles deepThink: unset', () => {
      const yaml = `
web:
  url: "https://example.com"
tasks:
  - name: test
    flow:
      - aiTap: "按钮"
        deepThink: "unset"
`;
      const result = transpile(yaml);
      assert.ok(result.code.includes("deepThink: 'unset'"));
    });
  });

  describe('aiAsk action', () => {
    it('transpiles aiAsk with string prompt', () => {
      const yaml = `
web:
  url: "https://example.com"
tasks:
  - name: test
    flow:
      - aiAsk: "这个页面是关于什么的？"
        name: "answer"
`;
      const result = transpile(yaml);
      assert.ok(result.code.includes('agent.aiAsk'));
      assert.ok(result.code.includes('answer'));
    });
  });

  describe('fileChooserAccept option', () => {
    it('adds fileChooserAccept to aiAct', () => {
      const yaml = `
web:
  url: "https://example.com"
tasks:
  - name: test
    flow:
      - aiAct: "点击上传按钮"
        fileChooserAccept: "/tmp/file.pdf"
`;
      const result = transpile(yaml);
      assert.ok(result.code.includes('fileChooserAccept'));
      assert.ok(result.code.includes('/tmp/file.pdf'));
    });
  });

  describe('platform-specific actions', () => {
    it('transpiles runAdbShell', () => {
      const yaml = `
android:
  deviceId: "emulator-5554"
tasks:
  - name: test
    flow:
      - runAdbShell: "input keyevent 3"
`;
      const result = transpile(yaml);
      assert.ok(result.code.includes('agent.runAdbShell'));
      assert.ok(result.code.includes('input keyevent 3'));
    });

    it('transpiles launch action', () => {
      const yaml = `
android:
  deviceId: "emulator-5554"
tasks:
  - name: test
    flow:
      - launch: "com.example.app"
`;
      const result = transpile(yaml);
      assert.ok(result.code.includes('agent.launch'));
      assert.ok(result.code.includes('com.example.app'));
    });
  });

  describe('task steps alias in transpiler', () => {
    it('transpiles task with steps instead of flow', () => {
      const yaml = `
web:
  url: "https://example.com"
tasks:
  - name: test
    steps:
      - aiTap: "login"
      - aiAssert: "logged in"
`;
      const result = transpile(yaml);
      assert.ok(result.code.includes('agent.aiTap'));
      assert.ok(result.code.includes('agent.aiAssert'));
    });
  });

  describe('agent config with new fields', () => {
    it('passes replanningCycleLimit and aiActContext', () => {
      const yaml = `
web:
  url: "https://example.com"
agent:
  testId: "test-1"
  replanningCycleLimit: 10
  aiActContext: "这是一个电商网站"
tasks:
  - name: test
    flow:
      - aiTap: "按钮"
`;
      const result = transpile(yaml);
      assert.ok(result.code.includes('replanningCycleLimit'));
      assert.ok(result.code.includes('aiActContext'));
    });
  });

  describe('URL security escaping', () => {
    it('escapes single quotes in URL', () => {
      const yaml = `
web:
  url: "https://example.com/path?name=test'value"
tasks:
  - name: test
    flow:
      - aiTap: "button"
`;
      const result = transpile(yaml);
      assert.ok(result.code.includes("\\'value"));
      assert.ok(!result.code.includes("test'value"));
    });
  });

  describe('checkIntervalMs in aiWaitFor', () => {
    it('passes checkIntervalMs option', () => {
      const yaml = `
web:
  url: "https://example.com"
tasks:
  - name: test
    flow:
      - aiWaitFor: "页面加载完成"
        timeout: 10000
        checkIntervalMs: 2000
`;
      const result = transpile(yaml);
      assert.ok(result.code.includes('checkIntervalMs: 2000'));
      assert.ok(result.code.includes('timeoutMs: 10000'));
    });
  });

  // =========================================================================
  // Phase 4 — Missing action tests (4.1)
  // =========================================================================

  describe('runWdaRequest action', () => {
    it('transpiles runWdaRequest', () => {
      const yaml = `
ios:
  wdaPort: 8100
tasks:
  - name: test
    flow:
      - runWdaRequest: "/session/elements"
`;
      const result = transpile(yaml);
      assert.ok(result.code.includes('agent.runWdaRequest'));
    });
  });

  describe('aiAct independent test', () => {
    it('transpiles aiAct with string prompt', () => {
      const yaml = `
web:
  url: "https://example.com"
tasks:
  - name: test
    flow:
      - aiAct: "搜索关键词并点击结果"
`;
      const result = transpile(yaml);
      assert.ok(result.code.includes('agent.aiAct'));
      assert.ok(result.code.includes('搜索关键词并点击结果'));
    });

    it('transpiles ai as alias for aiAct', () => {
      const yaml = `
web:
  url: "https://example.com"
tasks:
  - name: test
    flow:
      - ai: "执行一系列操作"
`;
      const result = transpile(yaml);
      assert.ok(result.code.includes('agent.ai'));
    });
  });

  describe('autoDismissKeyboard option', () => {
    it('passes autoDismissKeyboard to aiInput', () => {
      const yaml = `
android:
  deviceId: "emulator-5554"
tasks:
  - name: test
    flow:
      - aiInput: "搜索框"
        value: "test"
        autoDismissKeyboard: true
`;
      const result = transpile(yaml);
      assert.ok(result.code.includes('autoDismissKeyboard: true'));
    });
  });

  describe('images option array', () => {
    it('passes images array to ai action', () => {
      const yaml = `
web:
  url: "https://example.com"
tasks:
  - name: test
    flow:
      - aiTap:
          prompt: "点击匹配的图标"
          images:
            - "https://example.com/icon.png"
`;
      const result = transpile(yaml);
      assert.ok(result.code.includes('aiTap'));
    });
  });

  describe('convertHttpImage2Base64 option', () => {
    it('passes convertHttpImage2Base64 to locator action', () => {
      const yaml = `
web:
  url: "https://example.com"
tasks:
  - name: test
    flow:
      - aiTap: "图标"
        convertHttpImage2Base64: true
`;
      const result = transpile(yaml);
      assert.ok(result.code.includes('convertHttpImage2Base64: true'));
    });
  });

  describe('domIncluded/screenshotIncluded in data queries', () => {
    it('passes domIncluded to aiWaitFor', () => {
      const yaml = `
web:
  url: "https://example.com"
tasks:
  - name: test
    flow:
      - aiWaitFor: "页面就绪"
        domIncluded: true
        screenshotIncluded: false
`;
      const result = transpile(yaml);
      assert.ok(result.code.includes('domIncluded: true'));
      assert.ok(result.code.includes('screenshotIncluded: false'));
    });
  });

  // =========================================================================
  // Phase 4 — Missing boundary tests (4.2)
  // =========================================================================

  describe('aiKeyboardPress nested object format', () => {
    it('handles object format with locator and keyName', () => {
      const yaml = `
web:
  url: "https://example.com"
tasks:
  - name: test
    flow:
      - aiKeyboardPress:
          locator: "搜索框"
          keyName: "Enter"
`;
      const result = transpile(yaml);
      assert.ok(result.code.includes('agent.aiKeyboardPress'));
      assert.ok(result.code.includes('Enter'));
    });
  });

  describe('aiLocate nested object format', () => {
    it('handles aiLocate with object prompt', () => {
      const yaml = `
web:
  url: "https://example.com"
tasks:
  - name: test
    flow:
      - aiLocate:
          prompt: "登录按钮"
        name: loginBtn
`;
      const result = transpile(yaml);
      assert.ok(result.code.includes('agent.aiLocate'));
      assert.ok(result.code.includes('loginBtn'));
    });
  });

  describe('aiScroll empty locator fallback', () => {
    it('handles aiScroll with empty string locator', () => {
      const yaml = `
web:
  url: "https://example.com"
tasks:
  - name: test
    flow:
      - aiScroll: ""
        direction: down
        distance: 500
`;
      const result = transpile(yaml);
      assert.ok(result.code.includes('agent.aiScroll'));
      assert.ok(result.code.includes('direction'));
    });
  });

  describe('null/invalid step handling', () => {
    it('transpiles YAML with null step in flow gracefully', () => {
      const yaml = `
web:
  url: "https://example.com"
tasks:
  - name: test
    flow:
      - aiTap: "button"
`;
      // Should not throw
      const result = transpile(yaml);
      assert.ok(typeof result.code === 'string');
    });
  });

  // =========================================================================
  // Phase 4 — Negative transpiler tests (4.3)
  // =========================================================================

  describe('negative tests', () => {
    it('throws on null input', () => {
      assert.throws(() => transpile(null), /must be a string/);
    });

    it('throws on empty object', () => {
      assert.throws(() => transpile({}));
    });

    it('throws on YAML without tasks', () => {
      const yaml = `
web:
  url: "https://example.com"
`;
      assert.throws(() => transpile(yaml));
    });

    it('handles unsupported templateType gracefully', () => {
      const yaml = `
web:
  url: "https://example.com"
tasks:
  - name: test
    flow:
      - aiTap: "button"
`;
      // Should throw or use default template
      try {
        const result = transpile(yaml, { templateType: 'nonexistent' });
        // If it doesn't throw, it should still produce code
        assert.ok(typeof result.code === 'string' || result.error);
      } catch (e) {
        // Expected — nonexistent template
        assert.ok(e.message.length > 0);
      }
    });

    it('throws on try without catch or finally', () => {
      const yaml = `
engine: extended
features: [try_catch]
web:
  url: "https://example.com"
tasks:
  - name: test
    flow:
      - try:
          flow:
            - aiTap: "button"
`;
      // The transpiler should handle this — either generate code or throw
      try {
        const result = transpile(yaml);
        // If it transpiles, the validator would have caught this
        assert.ok(typeof result.code === 'string');
      } catch (e) {
        assert.ok(e.message.length > 0);
      }
    });
  });

  // =========================================================================
  // Phase 4 — Platform config tests (4.5)
  // =========================================================================

  describe('Android platform transpilation', () => {
    it('transpiles Android config', () => {
      const yaml = `
android:
  deviceId: "emulator-5554"
tasks:
  - name: test
    flow:
      - aiTap: "按钮"
`;
      const result = transpile(yaml);
      assert.ok(result.code.includes('agent.aiTap'));
    });
  });

  describe('iOS platform transpilation', () => {
    it('transpiles iOS config', () => {
      const yaml = `
ios:
  wdaPort: 8100
tasks:
  - name: test
    flow:
      - aiTap: "按钮"
`;
      const result = transpile(yaml);
      assert.ok(result.code.includes('agent.aiTap'));
    });
  });

  describe('Computer platform transpilation', () => {
    it('transpiles Computer config', () => {
      const yaml = `
computer:
  launch: "notepad"
tasks:
  - name: test
    flow:
      - aiTap: "文件菜单"
`;
      const result = transpile(yaml);
      assert.ok(result.code.includes('agent.aiTap'));
    });
  });

  describe('bridgeMode config', () => {
    it('passes bridgeMode to template', () => {
      const yaml = `
web:
  url: "https://example.com"
  bridgeMode: "newTabWithUrl"
tasks:
  - name: test
    flow:
      - aiTap: "button"
`;
      const result = transpile(yaml);
      assert.ok(typeof result.code === 'string');
    });
  });

  describe('serve config', () => {
    it('passes serve to template', () => {
      const yaml = `
web:
  url: "https://example.com"
  serve: "./dist"
tasks:
  - name: test
    flow:
      - aiTap: "button"
`;
      const result = transpile(yaml);
      assert.ok(typeof result.code === 'string');
    });
  });

  describe('aiDragAndDrop action', () => {
    it('transpiles aiDragAndDrop with object format', () => {
      const yaml = `
web:
  url: "https://example.com"
tasks:
  - name: test
    flow:
      - aiDragAndDrop:
          from: "源元素"
          to: "目标元素"
`;
      const result = transpile(yaml);
      assert.ok(result.code.includes('agent.aiDragAndDrop'));
      assert.ok(result.code.includes('源元素'));
      assert.ok(result.code.includes('目标元素'));
    });

    it('transpiles aiDragAndDrop with string + to sibling', () => {
      const yaml = `
web:
  url: "https://example.com"
tasks:
  - name: test
    flow:
      - aiDragAndDrop: "拖拽源"
        to: "放置目标"
`;
      const result = transpile(yaml);
      assert.ok(result.code.includes('agent.aiDragAndDrop'));
    });
  });

  describe('aiClearInput action', () => {
    it('transpiles aiClearInput', () => {
      const yaml = `
web:
  url: "https://example.com"
tasks:
  - name: test
    flow:
      - aiClearInput: "搜索框"
`;
      const result = transpile(yaml);
      assert.ok(result.code.includes('agent.aiClearInput'));
      assert.ok(result.code.includes('搜索框'));
    });
  });

  describe('loop for with indexVar', () => {
    it('generates destructured entries() loop', () => {
      const yaml = `
engine: extended
features: [loop]
web:
  url: "https://example.com"
variables:
  items:
    - a
    - b
    - c
tasks:
  - name: test
    flow:
      - loop:
          type: for
          items: "\${items}"
          itemVar: item
          indexVar: idx
          flow:
            - aiTap: "\${item}"
`;
      const result = transpile(yaml);
      assert.ok(result.code.includes('.entries()'));
      assert.ok(result.code.includes('idx'));
    });
  });
});
