/**
 * Cross-platform build script for lunr.js.
 *
 * Replaces the Unix-only shell pipelines (cat, sed, gzip, wc, rm) that the
 * Makefile previously relied on, so the project can be built and packaged on
 * Windows as well as Linux and macOS.
 *
 * Usage: node build/build.js <target>
 *   lunr.js     - Build the main bundle from lib/ sources.
 *   lunr.min.js - Minify lunr.js with uglify-js.
 *   bower.json | package.json | component.json
 *               - Generate a JSON file from its build/*.json.template.
 *   size        - Print the gzipped size of lunr.min.js in bytes.
 *   clean       - Remove generated files (lunr.js, lunr.min.js, docs/).
 */
var fs = require('fs'),
    path = require('path'),
    zlib = require('zlib')

var root = path.join(__dirname, '..')

var SRC = [
  'lib/lunr.js',
  'lib/utils.js',
  'lib/field_ref.js',
  'lib/set.js',
  'lib/idf.js',
  'lib/token.js',
  'lib/tokenizer.js',
  'lib/pipeline.js',
  'lib/vector.js',
  'lib/stemmer.js',
  'lib/stop_word_filter.js',
  'lib/trimmer.js',
  'lib/token_set.js',
  'lib/token_set_builder.js',
  'lib/index.js',
  'lib/builder.js',
  'lib/match_data.js',
  'lib/query.js',
  'lib/query_parse_error.js',
  'lib/query_lexer.js',
  'lib/query_parser.js'
]

var VERSION = read('VERSION').trim(),
    YEAR = new Date().getFullYear()

function read (file) {
  return fs.readFileSync(path.join(root, file), 'utf-8')
}

function write (file, contents) {
  fs.writeFileSync(path.join(root, file), contents)
}

function buildLunrJs () {
  var contents = read('build/wrapper_start') +
    SRC.map(function (file) { return read(file) }).join('\n') +
    read('build/wrapper_end')

  write('lunr.js', contents
    .replace(/@YEAR/g, YEAR)
    .replace(/@VERSION/g, VERSION))
}

function buildLunrMinJs () {
  var uglify = require('uglify-js'),
      result = uglify.minify(read('lunr.js'), {
        compress: true,
        mangle: true,
        output: { comments: /@license|@preserve|copyright/i }
      })

  if (result.error) throw result.error
  write('lunr.min.js', result.code)
}

function buildJson (name) {
  var template = read(path.join('build', name + '.json.template'))
  write(name + '.json', template.replace(/@VERSION/g, VERSION))
}

function size () {
  console.log(zlib.gzipSync(read('lunr.min.js'), { level: 9 }).length + ' bytes')
}

function clean () {
  ['lunr.js', 'lunr.min.js'].forEach(function (file) {
    fs.rmSync(path.join(root, file), { force: true })
  })
  fs.rmSync(path.join(root, 'docs'), { recursive: true, force: true })
}

var target = process.argv[2]

if (target === 'lunr.js') {
  buildLunrJs()
} else if (target === 'lunr.min.js') {
  buildLunrMinJs()
} else if (target === 'bower.json' || target === 'package.json' || target === 'component.json') {
  buildJson(target)
} else if (target === 'size') {
  size()
} else if (target === 'clean') {
  clean()
} else {
  throw new Error("unknown build target '" + target + "'")
}
