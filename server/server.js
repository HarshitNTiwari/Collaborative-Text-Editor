import { Server } from "socket.io";
import mongoose from "mongoose";
import Document from "./Document.js";
import otserver from "./ot/server.js";

mongoose.connect("mongodb://127.0.0.1:27017/text-editor-db");

var otServer = new otserver();

//server instance of socket
const io = new Server(3001, {
  cors: {
    origin: "http://localhost:5173", //Port on which client is running
    methods: ["GET", "POST"],
  },
});

io.on("connection", (socket) => {
  socket.on("get-document", async (documentId) => {
    const document = await findOrCreateDocument(documentId);

    socket.join(documentId); // the client is being added to this room
    socket.emit("load-document", document.data); //sending the data to the client

    socket.on("send-changes", (delta, version) => {
      //   console.log(delta);
      var deltaToSend = otServer.receiveDelta(version, delta);
      //   console.log(version);
      console.log("Here");
      console.log(deltaToSend);
      //broadcasting the changes to all the clients in the room with id = documentId, by emitting "receive-changes" event
      socket.broadcast.to(documentId).emit("receive-changes", deltaToSend);
      socket.emit("server-ack");
    });

    socket.on("save-document", async (data) => {
      await Document.findByIdAndUpdate(documentId, { data });
      //   console.log(data);
    });
  });

  //   console.log("connected");
});

// handler to find a document by id or create one if it does not exist and return it
async function findOrCreateDocument(id) {
  if (id == null) return;
  //   console.log("inside here");
  const document = await Document.findById(id);

  if (document) return document;
  return await Document.create({ _id: id, data: "" });
}
