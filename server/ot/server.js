import Delta from "quill-delta";

var ot = {};

ot.Server = (function (global) {
  function Server(document, deltas) {
    this.document = new Delta(document);
    this.deltas = deltas || [];
  }

  Server.prototype.receiveDelta = function (version, delta) {
    if (version < 0 || this.deltas.length < version) {
      throw new Error("given delta version not in history");
    }

    var concurrentDeltas = this.deltas.slice(version);

    var cumulativeDelta = new Delta(delta);
    console.log(cumulativeDelta);
    for (var i = 0; i < concurrentDeltas.length; i++) {
      var currentDelta = new Delta(concurrentDeltas[i]);
      cumulativeDelta = currentDelta.transform(cumulativeDelta, true);
    }

    this.document = this.document.compose(cumulativeDelta);

    this.deltas.push(cumulativeDelta);

    return cumulativeDelta;
  };

  return Server;
})(this);

export default ot.Server;
