suite('lunr', function () {
  setup(function () {
    this.documents = [{
      id: 'a',
      title: 'Mr. Green kills Colonel Mustard'
    }, {
      id: 'b',
      title: 'Plumb waters a plant'
    }]
  })

  suite('the factory', function () {
    setup(function () {
      var self = this

      this.idx = lunr(function () {
        this.ref('id')
        this.field('title')

        self.documents.forEach(function (document) {
          this.add(document)
        }, this)
      })
    })

    test('returns a lunr.Index', function () {
      assert.instanceOf(this.idx, lunr.Index)
    })

    test('indexes the provided fields', function () {
      assert.equal('a', this.idx.search('green')[0].ref)
    })

    test('stems terms through the default search pipeline', function () {
      assert.equal('a', this.idx.search('green')[0].ref)
      assert.equal('a', this.idx.search('kills')[0].ref)
    })

    test('removes stop words through the default pipeline', function () {
      assert.equal('b', this.idx.search('plant')[0].ref)
    })
  })

  suite('the config function', function () {
    test('is called with the builder as context and argument', function () {
      var builder = null,
          context = null

      lunr(function (arg) {
        builder = arg
        context = this

        this.ref('id')
        this.field('title')
        this.add({ id: 'a', title: 'foo' })
      })

      assert.instanceOf(builder, lunr.Builder)
      assert.equal(builder, context)
    })

    test('throws when no documents are added', function () {
      assert.throws(function () {
        lunr(function () {
          this.ref('id')
          this.field('title')
        })
      }, 'cannot build index with no documents')
    })
  })

  suite('lunr.version', function () {
    test('is a string', function () {
      assert.isString(lunr.version)
    })
  })
})
