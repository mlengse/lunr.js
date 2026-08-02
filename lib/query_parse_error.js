lunr.QueryParseError = function QueryParseError (message, start, end) {
  this.name = "QueryParseError"
  this.message = message
  this.start = start
  this.end = end

  if (Error.captureStackTrace) {
    Error.captureStackTrace(this, lunr.QueryParseError)
  } else {
    this.stack = (new Error(message)).stack
  }
}

lunr.QueryParseError.prototype = Object.create(Error.prototype)
lunr.QueryParseError.prototype.constructor = lunr.QueryParseError
