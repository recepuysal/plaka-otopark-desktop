import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import pngToIco from 'png-to-ico'
import sharp from 'sharp'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const rootDir = path.resolve(__dirname, '..')

const sourceImagePath = path.join(rootDir, 'assets', 'app-logo.jpg')
const buildDir = path.join(rootDir, 'build')
const outputPngPath = path.join(buildDir, 'icon.png')
const outputIcoPath = path.join(buildDir, 'icon.ico')

mkdirSync(buildDir, { recursive: true })

const sourceBuffer = readFileSync(sourceImagePath)
await sharp(sourceBuffer)
  .resize(256, 256, { fit: 'cover' })
  .png()
  .toFile(outputPngPath)

const icoBuffer = await pngToIco(outputPngPath)
writeFileSync(outputIcoPath, icoBuffer)

console.log(`[icon] generated ${path.relative(rootDir, outputIcoPath)}`)
