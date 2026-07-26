/*!
 * lunr.trimmer
 * Copyright (C) @YEAR Oliver Nightingale
 */

/**
 * lunr.trimmer is a pipeline function for trimming non word
 * characters from the beginning and end of tokens before they
 * enter the index.
 *
 * By default this implementation trims ASCII non-word characters (\W).
 * For non-latin characters, set `lunr.trimmer.wordCharacters` to a
 * string of allowed characters before tokenization. Language-specific
 * trimmers (e.g. from lunr-languages) should override this default.
 *
 * @static
 * @implements {lunr.PipelineFunction}
 * @param {lunr.Token} token The token to pass through the filter
 * @returns {lunr.Token}
 * @see lunr.Pipeline
 */
lunr.trimmer = function (token) {
  return token.update(function (s) {
    return s.replace(/^\W+/, '').replace(/\W+$/, '')
  })
}

lunr.trimmer.wordCharacters = "A-Za-z\xAA\xBA\xC0-\xD6\xD8-\xF6\xF8-\u02FF\u0370-\u037D\u037F-\u1FFF\u200C-\u200D\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD"

lunr.Pipeline.registerFunction(lunr.trimmer, 'trimmer')
