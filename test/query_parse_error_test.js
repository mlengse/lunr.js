suite('lunr.QueryParseError', function () {
  setup(function () {
    this.error = new lunr.QueryParseError ('unexpected character', 3, 6)
  })

  test('is an Error', function () {
    assert.instanceOf(this.error, Error)
  })

  test('has name set', function () {
    assert.equal('QueryParseError', this.error.name)
  })

  test('has message set', function () {
    assert.equal('unexpected character', this.error.message)
  })

  test('has start set', function () {
    assert.equal(3, this.error.start)
  })

  test('has end set', function () {
    assert.equal(6, this.error.end)
  })

  suite('thrown by the parser', function () {
    test('captures the position of the offending lexeme', function () {
      var query = new lunr.Query (['title']),
          parser = new lunr.QueryParser('foo~a', query)

      try {
        parser.parse()
      } catch (e) {
        assert.instanceOf(e, lunr.QueryParseError)
        assert.equal(4, e.start)
        assert.equal(4, e.end)
        return
      }

      assert.fail('parse did not throw')
    })
  })
})
