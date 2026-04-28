import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const rootDir = path.resolve(__dirname, '..')

const metaDir = path.join(rootDir, 'versioning')
const metaPath = path.join(metaDir, 'build-meta.json')
const generatedDir = path.join(rootDir, 'src', 'generated')
const generatedPath = path.join(generatedDir, 'appVersion.ts')

const defaultMeta = {
  baseVersion: '0.0.1',
  counter: 0,
}

function padBuild(buildNumber) {
  return String(buildNumber).padStart(3, '0')
}

function readMeta() {
  try {
    const raw = readFileSync(metaPath, 'utf-8')
    const parsed = JSON.parse(raw)
    if (typeof parsed.baseVersion !== 'string' || typeof parsed.counter !== 'number') {
      return defaultMeta
    }
    return parsed
  } catch {
    return defaultMeta
  }
}

const meta = readMeta()
meta.counter += 1

const appVersion = `v.${meta.baseVersion}.${padBuild(meta.counter)}`

mkdirSync(metaDir, { recursive: true })
writeFileSync(metaPath, `${JSON.stringify(meta, null, 2)}\n`, 'utf-8')

mkdirSync(generatedDir, { recursive: true })
writeFileSync(
  generatedPath,
  `export const APP_VERSION = '${appVersion}'\n`,
  'utf-8',
)

console.log(`[version] ${appVersion}`)
