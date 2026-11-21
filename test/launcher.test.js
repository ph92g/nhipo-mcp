'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { join } = require('node:path');
const { findNhipo, parseRegistry, stdoutFilter, fallbackHandle } = require('../bin/nhipo-mcp.js');

const noReg = () => {
  throw new Error('no entries');
};

test('findNhipo: per-user install folder first', () => {
  const env = { LOCALAPPDATA: 'C:\\Users\\a\\AppData\\Local', ProgramFiles: 'C:\\Program Files' };
  const want = join(env.LOCALAPPDATA, 'Programs', 'Nhipo', 'Nhipo.exe');
  assert.deepStrictEqual(findNhipo({ env, platform: 'win32', exists: (p) => p === want, reg: noReg }), { exe: want });
});

test('findNhipo: NHIPO_EXE is exact (no fallback search when it is wrong)', () => {
  const env = { NHIPO_EXE: 'D:\\Apps\\Nhipo\\Nhipo.exe', LOCALAPPDATA: 'C:\\L' };
  assert.deepStrictEqual(findNhipo({ env, platform: 'win32', exists: (p) => p === env.NHIPO_EXE, reg: noReg }), { exe: env.NHIPO_EXE });
  const r = findNhipo({ env, platform: 'win32', exists: () => false, reg: noReg });
  assert.match(r.problem, /NHIPO_EXE/);
});

test('findNhipo: custom folder found through the uninstall entries; other OS → problem', () => {
  const regOut = 'HKEY_LOCAL_MACHINE\\SOFTWARE\\...\\Uninstall\\{abc}\r\n    DisplayIcon    REG_SZ    E:\\Nhipo\\Nhipo.exe,0\r\n    UninstallString    REG_SZ    "E:\\Nhipo\\Uninstall Nhipo.exe" /allusers\r\n';
  const r = findNhipo({ env: {}, platform: 'win32', exists: (p) => p === 'E:\\Nhipo\\Nhipo.exe', reg: (args) => (args[1].startsWith('HKLM') ? regOut : '') });
  assert.deepStrictEqual(r, { exe: 'E:\\Nhipo\\Nhipo.exe' });
  assert.match(findNhipo({ env: {}, platform: 'linux' }).problem, /Windows/);
  assert.match(findNhipo({ env: {}, platform: 'win32', exists: () => false, reg: noReg }).problem, /not installed/);
});

test('parseRegistry: quoted and unquoted DisplayIcon, ignores the uninstaller', () => {
  const t = '    DisplayIcon    REG_SZ    "C:\\Users\\a b\\AppData\\Local\\Programs\\Nhipo\\Nhipo.exe",0\n    DisplayIcon    REG_SZ    C:\\X\\Uninstall Nhipo.exe\n';
  assert.deepStrictEqual(parseRegistry(t), ['C:\\Users\\a b\\AppData\\Local\\Programs\\Nhipo\\Nhipo.exe']);
});

test("stdoutFilter drops Electron's leading CRLF, passes JSON through untouched", () => {
  const out = [];
  const warn = [];
  const f = stdoutFilter((b) => out.push(Buffer.from(b).toString()), (s) => warn.push(s));
  f(Buffer.from('\r\n'));
  f(Buffer.from('{"jsonrpc":"2.0","id":0'));
  f(Buffer.from(',"result":{}}\n{"x":1}\n'));
  assert.strictEqual(out.join(''), '{"jsonrpc":"2.0","id":0,"result":{}}\n{"x":1}\n');
  assert.deepStrictEqual(warn, []);
  const out2 = [];
  const warn2 = [];
  const g = stdoutFilter((b) => out2.push(Buffer.from(b).toString()), (s) => warn2.push(s));
  g(Buffer.from('noise\r\n{"a":1}\n'));
  assert.strictEqual(out2.join(''), '{"a":1}\n');
  assert.strictEqual(warn2.length, 1);
});

test('fallback server: initialize, tools/list, nhipo_setup, unknown method, notifications', () => {
  const p = 'Nhipo is not installed on this computer.';
  const init = fallbackHandle({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18' } }, p);
  assert.strictEqual(init.result.protocolVersion, '2025-06-18');
  assert.deepStrictEqual(init.result.capabilities, { tools: {} });
  const list = fallbackHandle({ jsonrpc: '2.0', id: 2, method: 'tools/list' }, p);
  assert.deepStrictEqual(list.result.tools.map((t) => t.name), ['nhipo_setup']);
  const call = fallbackHandle({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'nhipo_setup', arguments: {} } }, p);
  assert.match(call.result.content[0].text, /discord\.gg\/N2J3XP6puh/);
  assert.strictEqual(fallbackHandle({ jsonrpc: '2.0', id: 4, method: 'resources/list' }, p).error.code, -32601);
  assert.strictEqual(fallbackHandle({ jsonrpc: '2.0', method: 'notifications/initialized' }, p), null);
});
