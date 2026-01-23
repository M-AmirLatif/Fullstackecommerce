const mongoose = require('mongoose')
const fs = require('fs')
const path = require('path')
const Product = require('../models/product')

const MONGO = process.env.MONGO_URI || 'mongodb://localhost:27017/ecommerce'
const IMAGES_DIR = path.join(__dirname, '..', 'public', 'images')
const BACKUP_FILE = path.join(__dirname, 'image-update-backup.json')
const APPLY = process.env.APPLY === '1' || process.argv.includes('--apply')

function normalize(str) {
  return (
    (str || '')
      .toString()
      .toLowerCase()
      // treat underscores and hyphens as spaces
      .replace(/[_-]+/g, ' ')
      // remove extension-like parts if any
      .replace(/\.(jpg|jpeg|png|webp|gif|svg)$/i, '')
      // keep only letters/numbers/spaces
      .replace(/[^a-z0-9]+/g, ' ')
      .trim()
  )
}

// tiny helper to make matching more forgiving
function singularize(word) {
  if (!word) return word
  if (word.endsWith('ies')) return word.slice(0, -3) + 'y'
  if (word.endsWith('s') && word.length > 3) return word.slice(0, -1)
  return word
}

async function run() {
  try {
    await mongoose.connect(MONGO)
    console.log('Connected to MongoDB')

    const files = fs.readdirSync(IMAGES_DIR).filter((f) => !f.startsWith('.'))
    const fileIndex = files.map((f) => ({
      file: f,
      name: normalize(path.parse(f).name),
    }))

    const products = await Product.find()
    console.log('Products to check:', products.length)

    let updated = 0
    let skipped = 0
    let unmatched = []
    const backups = []

    for (const p of products) {
      const current = (p.image || '').toString().trim()

      // ✅ If current already points to local images in ANY common format, skip
      // (prevents overwriting good data)
      const looksLocal =
        current.startsWith('/images/') ||
        current.startsWith('images/') ||
        current.startsWith('/public/images/') ||
        current.startsWith('public/images/')

      // detect placeholder/dummy/remote patterns that should be replaced
      const placeholderPatterns = [
        /dummyimage/i,
        /placeholder/i,
        /via\.placeholder/i,
        /placeholdit/i,
        /unsplash/i,
        /^https?:\/\//i,
      ]
      const isPlaceholder = placeholderPatterns.some((rx) => rx.test(current))

      if (looksLocal && !isPlaceholder) {
        skipped++
        continue
      }

      // normalize product name
      const pname = normalize(p.name)

      // try exact substring match (includes)
      let match = fileIndex.find(
        (fi) => fi.name.includes(pname) || pname.includes(fi.name),
      )

      // fallback: match by words intersection (with singularization)
      if (!match) {
        const pwords = pname.split(' ').filter(Boolean).map(singularize)

        let best = null
        let bestScore = 0

        for (const fi of fileIndex) {
          const fwords = fi.name.split(' ').filter(Boolean).map(singularize)

          const common = pwords.filter((w) => fwords.includes(w)).length
          const score = common / Math.max(pwords.length, 1)

          if (score > bestScore) {
            bestScore = score
            best = fi
          }
        }

        // keep your threshold logic, just a bit friendlier
        if (bestScore >= 0.34) match = best
      }

      if (match) {
        const newPath = `/images/${match.file}`

        backups.push({
          id: p._id.toString(),
          name: p.name,
          old: current,
          suggested: newPath,
        })

        if (APPLY) {
          p.image = newPath
          await p.save()
          console.log(`Applied: "${p.name}" -> ${newPath}`)
          updated++
        } else {
          console.log(
            `Preview: "${p.name}" -> ${newPath} (current: ${current})`,
          )
        }
      } else {
        unmatched.push({ name: p.name, current })
        console.log(`No match for product "${p.name}" (current: ${current})`)
      }
    }

    // write backup/suggestions
    if (backups.length) {
      fs.writeFileSync(
        BACKUP_FILE,
        JSON.stringify(
          { applied: APPLY, date: new Date().toISOString(), changes: backups },
          null,
          2,
        ),
      )
      console.log(`\nWrote backup/suggestions to ${BACKUP_FILE}`)
    }

    console.log(
      `\nDone. ${APPLY ? 'Applied' : 'Previewed'}: ${updated}, Skipped (already good): ${skipped}, Unmatched: ${unmatched.length}`,
    )

    if (unmatched.length) {
      console.log(
        'Unmatched products:',
        unmatched.map((u) => u.name || u).join(', '),
      )
    }

    process.exit(0)
  } catch (err) {
    console.error('Error:', err)
    process.exit(1)
  }
}

run()
