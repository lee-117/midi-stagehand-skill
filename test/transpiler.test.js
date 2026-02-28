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
      assert.ok(result.code.includes("const siteUrl = 'https://example.com'"),
        'Should declare top-level siteUrl variable');
      assert.ok(result.code.includes('const maxPages = 10'),
        'Should declare top-level maxPages variable');
      assert.ok(result.code.includes("const username = 'admin'"),
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

    it('transpiles aiAssert with errorMessage', () => {
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
      assert.ok(result.code.includes('errorMessage'));
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

    it('transpiles aiScroll with locator and scrollCount', () => {
      const yaml = `
web:
  url: "https://example.com"
tasks:
  - name: test
    flow:
      - aiScroll:
          locator: "商品列表"
          direction: "down"
          scrollCount: 3
`;
      const result = transpile(yaml);
      assert.ok(result.code.includes('agent.aiScroll'));
      assert.ok(result.code.includes('scrollCount: 3'));
      assert.ok(result.code.includes('商品列表'));
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
    it('transpiles aiKeyboardPress', () => {
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
      assert.ok(result.code.includes('Enter'));
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
      assert.ok(result.code.includes('b.price - a.price'));
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
      assert.ok(result.code.includes('b.price - a.price'));
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
    it('generates unique _iter counters for sibling while loops', () => {
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
      assert.ok(result.code.includes('let _iter = 0'),
        'First while loop should use _iter');
      assert.ok(result.code.includes('let _iter0 = 0'),
        'Second while loop should use _iter0 to avoid collision');
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
});
