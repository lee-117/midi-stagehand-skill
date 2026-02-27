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
});
