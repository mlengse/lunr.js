suite('lunr.trimmer', function () {
  test('latin characters', function () {
    var token = new lunr.Token ('hello')
    assert.equal(lunr.trimmer(token).toString(), token.toString())
  })

  suite('punctuation', function () {
    var trimmerTest = function (description, str, expected) {
      test(description, function () {
        var token = new lunr.Token(str),
            trimmed = lunr.trimmer(token).toString()

        assert.equal(expected, trimmed)
      })
    }

    trimmerTest('full stop', 'hello.', 'hello')
    trimmerTest('inner apostrophe', "it's", "it's")
    trimmerTest('trailing apostrophe', "james'", 'james')
    trimmerTest('exclamation mark', 'stop!', 'stop')
    trimmerTest('comma', 'first,', 'first')
    trimmerTest('brackets', '[tag]', 'tag')
  })

  test('is a registered pipeline function', function () {
    assert.equal(lunr.trimmer.label, 'trimmer')
    assert.equal(lunr.Pipeline.registeredFunctions['trimmer'], lunr.trimmer)
  })

  test('non-ascii word characters are preserved by default', function () {
    var token = new lunr.Token('éhello!'),
        trimmed = lunr.trimmer(token).toString()

    assert.equal('éhello', trimmed)
  })

  test('wordCharacters override is honoured', function () {
    var original = lunr.trimmer.wordCharacters

    lunr.trimmer.wordCharacters = 'A-Za-z'

    try {
      var token = new lunr.Token('éhello!'),
          trimmed = lunr.trimmer(token).toString()

      assert.equal('hello', trimmed)
    } finally {
      lunr.trimmer.wordCharacters = original
    }
  })
})
