/**
 * A function to calculate the inverse document frequency for
 * a posting. This is shared between the builder and the index
 *
 * @private
 * @param {object} posting - The posting for a given term
 * @param {number} documentCount - The total number of documents.
 */
lunr.idf = function (posting, documentCount) {
  var documentsWithTerm = 0

  for (var fieldName in posting) {
    if (fieldName === '_index') continue // Ignore the term index, its not a field
    if (!Object.prototype.hasOwnProperty.call(posting, fieldName)) continue

    var refs = posting[fieldName],
        refCount = 0

    for (var ref in refs) {
      if (Object.prototype.hasOwnProperty.call(refs, ref)) refCount++
    }

    documentsWithTerm += refCount
  }

  var x = (documentCount - documentsWithTerm + 0.5) / (documentsWithTerm + 0.5)

  return Math.log(1 + Math.abs(x))
}

