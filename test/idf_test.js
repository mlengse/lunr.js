suite('lunr.idf', function () {
  var expect = function (posting, documentCount) {
    var documentsWithTerm = 0

    for (var fieldName in posting) {
      if (fieldName === '_index') continue
      documentsWithTerm += Object.keys(posting[fieldName]).length
    }

    var x = (documentCount - documentsWithTerm + 0.5) / (documentsWithTerm + 0.5)
    return Math.log(1 + Math.abs(x))
  }

  test('empty posting returns log of 1 plus document count ratio', function () {
    assert.closeTo(lunr.idf({}, 1), Math.log(4), 1e-10)
  })

  test('counts refs across all fields', function () {
    var posting = {
      title: { 1: 1 },
      body: { 2: 3, 3: 2 }
    }

    assert.closeTo(lunr.idf(posting, 4), expect(posting, 4), 1e-10)
  })

  test('ignores the _index field', function () {
    var posting = {
      _index: { 1: 1, 2: 1, 3: 1 },
      title: { 1: 1 }
    }

    assert.closeTo(lunr.idf(posting, 1), Math.log(4 / 3), 1e-10)
  })

  test('ignores inherited enumerable properties', function () {
    var posting = Object.create({
      body: { 1: 1, 2: 1 }
    })

    posting.title = { 1: 1 }

    assert.closeTo(lunr.idf(posting, 1), Math.log(4 / 3), 1e-10)
  })

  test('handles documentsWithTerm greater than documentCount', function () {
    var posting = {
      title: { 1: 1, 2: 1 }
    }

    assert.closeTo(lunr.idf(posting, 1), Math.log(6 / 5), 1e-10)
  })

  test('higher document frequency produces lower idf', function () {
    var rare = lunr.idf({ title: { 1: 1 } }, 10),
        common = lunr.idf({ title: { 1: 1, 2: 1, 3: 1, 4: 1, 5: 1 } }, 10)

    assert.isBelow(common, rare)
  })
})
