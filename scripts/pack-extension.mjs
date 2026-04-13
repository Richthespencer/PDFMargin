import { mkdir, readdir, readFile, rm } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { resolve, relative, sep } from 'node:path';
import { spawn } from 'node:child_process';
import { deflateRawSync } from 'node:zlib';

const rootDir = resolve(process.cwd());
const extensionBuildDir = resolve(rootDir, 'dist-extension');
const releaseDir = resolve(rootDir, 'release');
const zipPath = resolve(releaseDir, 'pdfmargin-chrome-extension.zip');

function run(command, args) {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(command, args, {
      cwd: rootDir,
      stdio: 'inherit',
      shell: process.platform === 'win32',
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolvePromise();
        return;
      }
      rejectPromise(new Error(`${command} ${args.join(' ')} failed with code ${code ?? 'unknown'}`));
    });

    child.on('error', rejectPromise);
  });
}

function crc32(buffer) {
  let crc = 0 ^ -1;
  for (let i = 0; i < buffer.length; i += 1) {
    crc ^= buffer[i];
    for (let j = 0; j < 8; j += 1) {
      const mask = -(crc & 1);
      crc = (crc >>> 1) ^ (0xedb88320 & mask);
    }
  }
  return (crc ^ -1) >>> 0;
}

function dateToDos(date) {
  const year = Math.max(1980, date.getFullYear());
  const dosTime = (date.getSeconds() >> 1) | (date.getMinutes() << 5) | (date.getHours() << 11);
  const dosDate = date.getDate() | ((date.getMonth() + 1) << 5) | ((year - 1980) << 9);
  return { dosTime, dosDate };
}

function writeUInt16LE(stream, value) {
  const buf = Buffer.allocUnsafe(2);
  buf.writeUInt16LE(value, 0);
  stream.write(buf);
}

function writeUInt32LE(stream, value) {
  const buf = Buffer.allocUnsafe(4);
  buf.writeUInt32LE(value >>> 0, 0);
  stream.write(buf);
}

await run('npm', ['run', 'build:extension']);
await rm(releaseDir, { recursive: true, force: true });
await mkdir(releaseDir, { recursive: true });

async function collectFiles(baseDir, currentDir = baseDir) {
  const entries = await readdir(currentDir, { withFileTypes: true });
  const output = [];
  for (const entry of entries) {
    const absolutePath = resolve(currentDir, entry.name);
    if (entry.isDirectory()) {
      const nested = await collectFiles(baseDir, absolutePath);
      output.push(...nested);
      continue;
    }
    output.push(relative(baseDir, absolutePath).split(sep).join('/'));
  }
  return output;
}

const filePaths = (await collectFiles(extensionBuildDir)).sort();

const stream = createWriteStream(zipPath);
const centralDirectory = [];
let offset = 0;

for (const filePath of filePaths) {
  const absolutePath = resolve(extensionBuildDir, filePath);
  const normalizedPath = relative(extensionBuildDir, absolutePath).split(sep).join('/');
  const content = await readFile(absolutePath);
  const deflated = deflateRawSync(content, { level: 9 });
  const checksum = crc32(content);
  const { dosTime, dosDate } = dateToDos(new Date());
  const nameBuffer = Buffer.from(normalizedPath, 'utf8');

  writeUInt32LE(stream, 0x04034b50);
  writeUInt16LE(stream, 20);
  writeUInt16LE(stream, 0);
  writeUInt16LE(stream, 8);
  writeUInt16LE(stream, dosTime);
  writeUInt16LE(stream, dosDate);
  writeUInt32LE(stream, checksum);
  writeUInt32LE(stream, deflated.length);
  writeUInt32LE(stream, content.length);
  writeUInt16LE(stream, nameBuffer.length);
  writeUInt16LE(stream, 0);
  stream.write(nameBuffer);
  stream.write(deflated);

  centralDirectory.push({
    nameBuffer,
    checksum,
    compressedSize: deflated.length,
    uncompressedSize: content.length,
    dosTime,
    dosDate,
    offset,
  });

  offset += 30 + nameBuffer.length + deflated.length;
}

const centralOffset = offset;
for (const entry of centralDirectory) {
  writeUInt32LE(stream, 0x02014b50);
  writeUInt16LE(stream, 20);
  writeUInt16LE(stream, 20);
  writeUInt16LE(stream, 0);
  writeUInt16LE(stream, 8);
  writeUInt16LE(stream, entry.dosTime);
  writeUInt16LE(stream, entry.dosDate);
  writeUInt32LE(stream, entry.checksum);
  writeUInt32LE(stream, entry.compressedSize);
  writeUInt32LE(stream, entry.uncompressedSize);
  writeUInt16LE(stream, entry.nameBuffer.length);
  writeUInt16LE(stream, 0);
  writeUInt16LE(stream, 0);
  writeUInt16LE(stream, 0);
  writeUInt16LE(stream, 0);
  writeUInt32LE(stream, 0);
  writeUInt32LE(stream, entry.offset);
  stream.write(entry.nameBuffer);

  offset += 46 + entry.nameBuffer.length;
}

const centralSize = offset - centralOffset;
writeUInt32LE(stream, 0x06054b50);
writeUInt16LE(stream, 0);
writeUInt16LE(stream, 0);
writeUInt16LE(stream, centralDirectory.length);
writeUInt16LE(stream, centralDirectory.length);
writeUInt32LE(stream, centralSize);
writeUInt32LE(stream, centralOffset);
writeUInt16LE(stream, 0);

await new Promise((resolvePromise, rejectPromise) => {
  stream.end(() => resolvePromise());
  stream.on('error', rejectPromise);
});
