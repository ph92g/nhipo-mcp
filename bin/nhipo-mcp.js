#!/usr/bin/env node
// Nhipo MCP launcher: finds the installed Nhipo app and runs its built-in MCP server (`Nhipo.exe --mcp`) over stdio.
// No dependencies. If Nhipo is not installed (or the OS is not Windows), it serves a tiny MCP server with one tool,
// `nhipo_setup`, that explains how to get Nhipo – so MCP clients show a useful message instead of a failed server.
'use strict';
const { spawn, execFileSync } = require('node:child_process');
const { existsSync } = require('node:fs');
const { join } = require('node:path');

const VERSION = '0.1.0';
const DISCORD = 'https://discord.gg/N2J3XP6puh';
const GUIDE = 'https://github.com/ph92g/nhipo-mcp';

/** Default install folders (per-user NSIS install first). */
function defaultPaths(env) {
  const out = [];
  if (env.LOCALAPPDATA) out.push(join(env.LOCALAPPDATA, 'Programs', 'Nhipo', 'Nhipo.exe'));
  if (env.ProgramFiles) out.push(join(env.ProgramFiles, 'Nhipo', 'Nhipo.exe'));
  if (env['ProgramFiles(x86)']) out.push(join(env['ProgramFiles(x86)'], 'Nhipo', 'Nhipo.exe'));
  return out;
}

/** Nhipo.exe paths from the Windows uninstall entries (installs in a custom folder). */
function parseRegistry(text) {
  const found = [];
  for (const m of String(text).matchAll(/^\s*DisplayIcon\s+REG_\w+\s+"?([^",\r\n]*?\\Nhipo\.exe)"?(?:,\s*-?\d+)?\s*$/gim)) found.push(m[1]);
  return found;
}

function registryPaths(reg) {
  const found = [];
  for (const hive of ['HKCU', 'HKLM']) {
    try {
      found.push(...parseRegistry(reg(['query', `${hive}\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall`, '/s', '/f', 'Nhipo.exe', '/d'])));
    } catch {
      /* no entries in this hive */
    }
  }
  return found;
}

const realReg = (args) => execFileSync('reg', args, { encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'], timeout: 10000 });

/**
 * Where Nhipo.exe is: NHIPO_EXE (exact, no fallback search), then the default folders, then the uninstall entries.
 * Returns { exe } or { problem } (a sentence for the user).
 */
function findNhipo({ env = process.env, platform = process.platform, exists = existsSync, reg = realReg } = {}) {
  if (platform !== 'win32') return { problem: 'Nhipo currently runs on Windows 10/11 (64-bit) only.' };
  if (env.NHIPO_EXE) return exists(env.NHIPO_EXE) ? { exe: env.NHIPO_EXE } : { problem: `NHIPO_EXE points to a file that does not exist: ${env.NHIPO_EXE}` };
  for (const p of [...defaultPaths(env), ...registryPaths(reg)]) if (exists(p)) return { exe: p };
  return { problem: 'Nhipo is not installed on this computer.' };
}

/**
 * Electron on Windows writes "\r\n" to stdout before the app's own code runs. Strict MCP clients treat that empty line as
 * a protocol error, so everything before the first JSON message is dropped (sent to stderr if it is not whitespace).
 */
function stdoutFilter(write, warn = (s) => process.stderr.write(s)) {
  let started = false;
  let pending = Buffer.alloc(0);
  return (chunk) => {
    if (started) return write(chunk);
    pending = Buffer.concat([pending, Buffer.from(chunk)]);
    const i = pending.indexOf(0x7b); // '{'
    if (i < 0) return;
    const junk = pending.subarray(0, i).toString('utf8');
    if (junk.trim()) warn(`[nhipo-mcp] dropped non-JSON output: ${junk.trim().slice(0, 200)}\n`);
    started = true;
    write(pending.subarray(i));
    pending = Buffer.alloc(0);
  };
}

function setupText(problem) {
  return [
    problem,
    '',
    'Nhipo is a free AI video editor that runs on your PC. Its MCP server lets you edit videos, dub and translate them,',
    'make sound effects and animated stories, and check videos for flaws, right from this assistant.',
    '',
    `1. Download Nhipo for free from the #download channel of the Nhipo Discord: ${DISCORD}`,
    '2. Install it (Windows 10/11, 64-bit) and open it once.',
    '3. Restart this assistant. If Nhipo is installed in an unusual folder, set the NHIPO_EXE environment variable to the',
    '   full path of Nhipo.exe in this MCP server\'s configuration.',
    '',
    `Guide: ${GUIDE}`
  ].join('\n');
}

/** Minimal MCP server used when Nhipo cannot be started: answers one JSON-RPC message, or null for notifications. */
function fallbackHandle(msg, problem) {
  if (!msg || typeof msg !== 'object' || msg.id === undefined || msg.id === null) return null;
  const ok = (result) => ({ jsonrpc: '2.0', id: msg.id, result });
  switch (msg.method) {
    case 'initialize':
      return ok({
        protocolVersion: (msg.params && msg.params.protocolVersion) || '2025-06-18',
        capabilities: { tools: {} },
        serverInfo: { name: 'nhipo', version: VERSION },
        instructions: `${problem} Call nhipo_setup and show the user how to install Nhipo.`
      });
    case 'ping':
      return ok({});
    case 'tools/list':
      return ok({
        tools: [
          {
            name: 'nhipo_setup',
            title: 'Set up Nhipo',
            description: 'Nhipo (local AI video editor) is not available on this computer yet. Returns how to install it so its video tools (edit, dub, sound effects, stories, video checks) become available.',
            inputSchema: { type: 'object', properties: {} },
            annotations: { readOnlyHint: true, openWorldHint: false }
          }
        ]
      });
    case 'tools/call':
      if (msg.params && msg.params.name === 'nhipo_setup') return ok({ content: [{ type: 'text', text: setupText(problem) }] });
      return { jsonrpc: '2.0', id: msg.id, error: { code: -32602, message: `Unknown tool: ${msg.params && msg.params.name}` } };
    default:
      return { jsonrpc: '2.0', id: msg.id, error: { code: -32601, message: `Method not found: ${msg.method}` } };
  }
}

function serveFallback(problem) {
  process.stderr.write(`[nhipo-mcp] ${problem}\n`);
  let buf = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (d) => {
    buf += d;
    let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i).trim();
      buf = buf.slice(i + 1);
      if (!line) continue;
      let msg;
      try {
        msg = JSON.parse(line);
      } catch {
        process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } }) + '\n');
        continue;
      }
      const reply = fallbackHandle(msg, problem);
      if (reply) process.stdout.write(JSON.stringify(reply) + '\n');
    }
  });
  process.stdin.on('end', () => process.exit(0));
}

function runNhipo(exe, extraArgs) {
  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE; // Nhipo must start as an app, not as Node
  const child = spawn(exe, ['--mcp', ...extraArgs], { stdio: ['pipe', 'pipe', 'inherit'], windowsHide: true, env });
  process.stdin.pipe(child.stdin);
  child.stdout.on('data', stdoutFilter((b) => process.stdout.write(b)));
  child.on('error', (e) => {
    process.stderr.write(`[nhipo-mcp] could not start ${exe}: ${e.message}\n`);
    process.exit(1);
  });
  child.on('exit', (code) => process.exit(code === null ? 1 : code));
  for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => child.kill());
}

function main() {
  const r = findNhipo();
  if (r.exe) runNhipo(r.exe, process.argv.slice(2));
  else serveFallback(r.problem);
}

module.exports = { findNhipo, parseRegistry, stdoutFilter, fallbackHandle, setupText, defaultPaths, VERSION };
if (require.main === module) main();
