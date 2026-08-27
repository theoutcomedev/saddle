const fs = require('fs');
const content = fs.readFileSync('packages/llm/llm-pi-ai/src/config.ts', 'utf8');
const patched = content.replace(/as unknown as any/g, 'as never');
fs.writeFileSync('packages/llm/llm-pi-ai/src/config.ts', patched);
