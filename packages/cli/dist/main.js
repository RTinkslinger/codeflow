import { CodeflowMCP } from './mcp.js';
import { createLogger, LOG_DIR } from '@codeflow/core';
import { runDoctor } from './doctor.js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(path.resolve(__dirname, '../../../package.json'), 'utf-8'));
const args = process.argv.slice(2);
// Handle --version flag (required by smoke test and doctor)
if (args[0] === '--version' || args[0] === '-v') {
    process.stdout.write(pkg.version + '\n');
    process.exit(0);
}
// Handle doctor subcommand
if (args[0] === 'doctor') {
    const report = await runDoctor();
    process.stdout.write(JSON.stringify(report, null, 2) + '\n');
    process.exit(0);
}
// Handle logs tail subcommand
if (args[0] === 'logs' && args[1] === 'tail') {
    const today = new Date().toISOString().slice(0, 10);
    const logFile = path.join(LOG_DIR, `server-${today}.log`);
    execFileSync('tail', ['-f', '-n', '100', logFile], { stdio: [0, 1, 2] });
    process.exit(0);
}
// Handle one-shot render_once <path> (required by smoke test)
if (args[0] === 'render_once' && args[1]) {
    const mcp = new CodeflowMCP();
    mcp.renderOnce({ path: args[1] })
        .then(({ filePath }) => {
        process.stdout.write(JSON.stringify({ filePath }) + '\n');
        process.exit(0);
    })
        .catch(err => {
        process.stderr.write(String(err) + '\n');
        process.exit(1);
    });
}
else {
    // MCP JSON-RPC stdio mode
    const logger = await createLogger('info');
    const mcp = new CodeflowMCP();
    process.stdin.setEncoding('utf-8');
    let buf = '';
    process.stdin.on('data', (chunk) => {
        buf += chunk;
        const lines = buf.split('\n');
        buf = lines.pop() ?? '';
        for (const line of lines) {
            if (!line.trim())
                continue;
            handleRequest(mcp, line.trim(), logger).catch(err => logger.error({ err }, 'request error'));
        }
    });
    process.stdin.on('end', async () => { await mcp.shutdown(); process.exit(0); });
}
const MCP_TOOLS = [
    {
        name: 'start_preview',
        description: 'Start a live browser preview of the module dependency graph for a directory.',
        inputSchema: {
            type: 'object',
            properties: {
                path: { type: 'string', description: 'Absolute path to the directory to analyze' },
                verified: { type: 'boolean', description: 'Use type-resolved extractors (slower, more accurate)' },
            },
            required: ['path'],
        },
    },
    {
        name: 'list_previews',
        description: 'List all active codeflow previews.',
        inputSchema: { type: 'object', properties: {} },
    },
    {
        name: 'stop_preview',
        description: 'Stop an active codeflow preview.',
        inputSchema: {
            type: 'object',
            properties: { previewId: { type: 'string', description: 'Preview ID to stop' } },
            required: ['previewId'],
        },
    },
    {
        name: 'get_ir',
        description: 'Get the current IR (intermediate representation) for a preview.',
        inputSchema: {
            type: 'object',
            properties: { previewId: { type: 'string', description: 'Preview ID' } },
            required: ['previewId'],
        },
    },
    {
        name: 'render_once',
        description: 'Render a one-shot Mermaid diagram for a directory without starting a live preview.',
        inputSchema: {
            type: 'object',
            properties: { path: { type: 'string', description: 'Absolute path to the directory to analyze' } },
            required: ['path'],
        },
    },
];
async function handleRequest(mcp, line, logger) {
    let req;
    try {
        req = JSON.parse(line);
    }
    catch {
        process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } }) + '\n');
        return;
    }
    // MCP protocol methods
    if (req.method === 'initialize') {
        process.stdout.write(JSON.stringify({
            jsonrpc: '2.0', id: req.id,
            result: {
                protocolVersion: '2024-11-05',
                capabilities: { tools: {} },
                serverInfo: { name: 'codeflow', version: pkg.version },
            },
        }) + '\n');
        return;
    }
    if (req.method === 'notifications/initialized')
        return; // no response for notifications
    if (req.method === 'tools/list') {
        process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: req.id, result: { tools: MCP_TOOLS } }) + '\n');
        return;
    }
    if (req.method === 'tools/call') {
        const { name, arguments: toolArgs } = req.params;
        try {
            let result;
            switch (name) {
                case 'start_preview':
                    result = await mcp.startPreview(toolArgs);
                    break;
                case 'list_previews':
                    result = await mcp.listPreviews();
                    break;
                case 'stop_preview':
                    result = await mcp.stopPreview(toolArgs);
                    break;
                case 'get_ir':
                    result = await mcp.getIR(toolArgs);
                    break;
                case 'render_once':
                    result = await mcp.renderOnce(toolArgs);
                    break;
                default: {
                    process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: req.id, error: { code: -32601, message: `Unknown tool: ${name}` } }) + '\n');
                    return;
                }
            }
            process.stdout.write(JSON.stringify({
                jsonrpc: '2.0', id: req.id,
                result: { content: [{ type: 'text', text: JSON.stringify(result) }] },
            }) + '\n');
        }
        catch (err) {
            logger.error({ err }, 'tools/call error');
            process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: req.id, error: { code: -32603, message: String(err) } }) + '\n');
        }
        return;
    }
    // Legacy custom JSON-RPC methods (for wire tests and render_once subprocess)
    try {
        let result;
        switch (req.method) {
            case 'start_preview':
                result = await mcp.startPreview(req.params);
                break;
            case 'list_previews':
                result = await mcp.listPreviews();
                break;
            case 'stop_preview':
                result = await mcp.stopPreview(req.params);
                break;
            case 'get_ir':
                result = await mcp.getIR(req.params);
                break;
            case 'render_once':
                result = await mcp.renderOnce(req.params);
                break;
            default: {
                process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: req.id, error: { code: -32601, message: `Method not found: ${req.method}` } }) + '\n');
                return;
            }
        }
        process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: req.id, result }) + '\n');
    }
    catch (err) {
        logger.error({ err }, 'handleRequest error');
        process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: req.id, error: { code: -32603, message: String(err) } }) + '\n');
    }
}
//# sourceMappingURL=main.js.map