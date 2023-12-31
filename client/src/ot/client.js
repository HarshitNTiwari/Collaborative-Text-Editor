// Modified from the MIT licensed https://github.com/Operational-Transformation/ot.js
import Delta from "quill-delta";
var ot = {};
console.log("Yes");

ot.Client = (function (global) {
  console.log("Inside otClient");
  // An ot client keeps only the next expected version number and its current state
  /**
   * Create an instance of an OT client
   * @param {Number} Version Initial version of the document
   */
  function Client(version) {
    this.version = version || 0; // the next expected version number
    this.state = synchronized_; // start state
  }

  //   Client.prototype.printData = function () {
  //     console.log("printing");
  //   };

  Client.prototype.setState = function (state) {
    // console.log(state);
    this.state = state;
  };

  /**
   * Call this method when the user changes the document
   * @param {Object} Delta Delta we got from client
   */
  Client.prototype.applyFromClient = function (delta) {
    this.setState(this.state.applyFromClient(this, delta));
  };

  /**
   * Call this method with a new delta from the server
   * @param {Object} Delta Delta we got from server
   */
  Client.prototype.applyFromServer = function (delta) {
    this.version++;
    this.setState(this.state.applyFromServer(this, delta));
  };

  /**
   * The server acknowledged our previously outstanding Delta or Buffer of Deltas
   */
  Client.prototype.serverAck = function () {
    this.version++;
    this.setState(this.state.serverAck(this));
  };

  Client.prototype.serverReconnect = function () {
    if (typeof this.state.resend === "function") {
      this.state.resend(this);
    }
  };

  // Transforms a selection from the latest known server state to the current
  // client state. For example, if we get from the server the information that
  // another user's cursor is at position 3, but the server hasn't yet received
  // our newest delta, an insertion of 5 characters at the beginning of the
  // document, the correct position of the other user's cursor in our current
  // document is 8.
  Client.prototype.transformSelection = function (selection) {
    return this.state.transformSelection(selection);
  };

  // Override this method.
  Client.prototype.sendDelta = function (version, delta) {
    throw new Error("sendDelta must be defined in child class");
  };

  // Override this method.
  Client.prototype.applyDelta = function (delta) {
    throw new Error("applyDelta must be defined in child class");
  };

  // In the 'Synchronized' state, there is no pending delta that the client
  // has sent to the server.
  function Synchronized() {}
  Client.Synchronized = Synchronized;

  Synchronized.prototype.applyFromClient = function (client, delta) {
    // When the user makes an edit, send the delta to the server and
    // switch to the 'AwaitingConfirm' state
    client.sendDelta(client.version, delta);
    return new AwaitingConfirm(delta);
  };

  Synchronized.prototype.applyFromServer = function (client, delta) {
    // When we receive a new delta from the server, the delta can be
    // simply applied to the current document
    client.applyDelta(delta);
    return this;
  };

  // Trying to confirm a Delta that doesn't exist is an error
  Synchronized.prototype.serverAck = function (client) {
    throw new Error("There is no pending delta.");
  };

  // Nothing to do because the latest server state and client state are the same.
  Synchronized.prototype.transformSelection = function (x) {
    return x;
  };

  // Singleton
  var synchronized_ = new Synchronized();

  // In the 'AwaitingConfirm' state, there's one delta the client has sent
  // to the server and is still waiting for an acknowledgement.
  function AwaitingConfirm(outstanding) {
    // Save the pending delta
    this.outstanding = outstanding;
  }
  Client.AwaitingConfirm = AwaitingConfirm;

  AwaitingConfirm.prototype.applyFromClient = function (client, delta) {
    // When the user makes an edit, don't send the delta immediately,
    // instead switch to 'AwaitingWithBuffer' state
    // It will be sent
    return new AwaitingWithBuffer(this.outstanding, delta);
  };

  AwaitingConfirm.prototype.applyFromServer = function (client, delta) {
    // This is another client's delta. Visualization:
    //
    //                   /\
    // this.outstanding /  \ delta
    //                 /    \
    //                 \    /
    //  pair[1]         \  / pair[0] (new outstanding)
    //  (can be applied  \/
    //  to the client's
    //  current document)

    // False means this.outstanding takes priority over the invoked delta
    var newOutstanding = this.outstanding.transform(delta, false);
    client.applyDelta(newOutstanding);
    return new AwaitingConfirm(newOutstanding);
  };

  AwaitingConfirm.prototype.serverAck = function (client) {
    // The client's delta has been acknowledged
    // => switch to synchronized state
    return synchronized_;
  };

  AwaitingConfirm.prototype.transformSelection = function (selection) {
    return selection.transform(this.outstanding);
  };

  AwaitingConfirm.prototype.resend = function (client) {
    // The confirm didn't come because the client was disconnected.
    // Now that it has reconnected, we resend the outstanding delta.
    client.sendDelta(client.version, this.outstanding);
  };

  // In the 'AwaitingWithBuffer' state, the client is waiting for a delta
  // to be acknowledged by the server while buffering the edits the user makes
  function AwaitingWithBuffer(outstanding, buffer) {
    // Save the pending delta and the user's edits since then
    this.outstanding = outstanding;
    this.buffer = buffer;
  }
  Client.AwaitingWithBuffer = AwaitingWithBuffer;

  AwaitingWithBuffer.prototype.applyFromClient = function (client, delta) {
    // Compose the user's changes onto the buffer
    var newBuffer = this.buffer.compose(delta);
    return new AwaitingWithBuffer(this.outstanding, newBuffer);
  };

  AwaitingWithBuffer.prototype.applyFromServer = function (client, delta) {
    // delta comes from another client
    //
    //                       /\
    //     this.outstanding /  \ delta
    //                     /    \
    //                    /\    /
    //       this.buffer /  \* / pair1[0] (new outstanding)
    //                  /    \/
    //                  \    /
    //          pair2[1] \  / pair2[0] (new buffer)
    // the transformed    \/
    // delta -- can
    // be applied to the
    // client's current
    // document
    //
    // * pair1[1]
    console.log("Inside Awaiting Buffer ");
    console.log(client);

    const delta1 = new Delta([
      { insert: "Gandalf", attributes: { bold: true } },
      { insert: " the " },
      { insert: "Grey", attributes: { color: "#ccc" } },
    ]);

    // console.log(delta);

    const delta2 = new Delta()
      .retain(12)
      .insert("White", { color: "#fff" })
      .delete(4);

    console.log(delta1);
    console.log(delta1.transform(delta2, true));

    console.log(delta);
    var newDelta = new Delta(delta);
    console.log(newDelta);
    var newOutstanding = newDelta.transform(this.outstanding, false);
    var newBuffer = newDelta.transform(this.buffer, false);
    var toApply = newOutstanding.transform(newDelta, false);
    console.log("after transform");
    // The delta should already be well formed for applying
    client.applyDelta(toApply);
    return new AwaitingWithBuffer(newOutstanding, newBuffer);
  };

  AwaitingWithBuffer.prototype.serverAck = function (client) {
    // The pending delta has been acknowledged
    // => send buffer
    client.sendDelta(client.version, this.buffer);
    return new AwaitingConfirm(this.buffer);
  };

  AwaitingWithBuffer.prototype.transformSelection = function (selection) {
    return selection.transform(this.outstanding).transform(this.buffer);
  };

  AwaitingWithBuffer.prototype.resend = function (client) {
    // The confirm didn't come because the client was disconnected.
    // Now that it has reconnected, we resend the outstanding delta.
    client.sendDelta(client.version, this.outstanding);
  };

  return Client;
})(this);

export default ot.Client;
