import { copyFile, readdir, readFile, writeFile } from 'node:fs/promises'
import { extname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const outputDirectoryUrl = new URL('../dist/', import.meta.url)
const outputDirectory = fileURLToPath(outputDirectoryUrl)
const textExtensions = new Set(['.css', '.html', '.js', '.json', '.map', '.svg'])

async function rewriteAssetPaths(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) {
      await rewriteAssetPaths(path)
      continue
    }
    if (!textExtensions.has(extname(entry.name))) continue
    const source = await readFile(path, 'utf8')
    const rewritten = source.replace(/(["'`(])\/assets\//g, '$1/brandflow-os/assets/')
    if (rewritten !== source) await writeFile(path, rewritten)
  }
}

await rewriteAssetPaths(outputDirectory)
await copyFile(new URL('index.html', outputDirectoryUrl), new URL('404.html', outputDirectoryUrl))
