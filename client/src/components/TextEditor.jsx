import React, { useEffect, useRef, useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import Quill from "quill";
import "quill/dist/quill.snow.css"; // importing the stylesheet
import { io } from "socket.io-client";
import otclient from "../ot/client.js";

var otClient = new otclient(0);

const TOOLBAR_OPTIONS = [
  [{ header: [1, 2, 3, 4, 5, 6, false] }],
  [{ font: [] }],
  [{ list: "ordered" }, { list: "bullet" }],
  ["bold", "italic", "underline"],
  [{ color: [] }, { background: [] }],
  [{ script: "sub" }, { script: "super" }],
  [{ align: [] }],
  ["image", "blockquote", "code-block"],
  ["clean"],
];

const SAVE_INTERVAL_MS = 2000;

export default function TextEditor() {
  const { id: documentId } = useParams();
  const [socket, setSocket] = useState();
  const [quill, setQuill] = useState();

  // to set up the socket connection which will be done only on the first render
  useEffect(() => {
    const s = io("http://localhost:3001"); //Port on which server is running
    setSocket(s);
    return () => {
      s.disconnect();
    };
  }, []);

  // to get access to a particular document by joining the room corresponding to that document
  useEffect(() => {
    if (socket == null || quill == null) return;

    // document (i.e. is data of the document) is returned by the server along with the 'load-document' event
    socket.once("load-document", (document) => {
      quill.setContents(document);
      quill.enable(); // Initally the text editor was disabled. Now as we got access to the document, it is enabled
    });

    // sending the 'get-document' event to the server to ask it to join this user to the room with id = documentId
    socket.emit("get-document", documentId);
  }, [socket, quill, documentId]);

  useEffect(() => {
    if (socket == null || quill == null) return;

    const interval = setInterval(() => {
      socket.emit("save-document", quill.getContents());
    }, SAVE_INTERVAL_MS);

    return () => {
      clearInterval(interval);
    };
  }, [socket, quill]);

  //to receive the changes from the server
  useEffect(() => {
    if (socket == null || quill == null) return;

    otClient.applyDelta = function (delta) {
      console.log("applying delta");
      console.log(delta);
      quill.updateContents(delta); //updating the changes received to all the instances of the same doc
    };

    // the delta received by the server is applied to the editor
    const receiveChangeHandler = (delta) => {
      console.log(otClient.state);
      // quill.updateContents(delta); //updating the changes received to all the instances of the same doc
      otClient.applyFromServer(delta);
    };

    //listening to "receive-changes" event from the server
    socket.on("receive-changes", receiveChangeHandler);

    return () => {
      socket.off("receive-changes", receiveChangeHandler);
    };
  }, [socket, quill]);

  // to detect text changes in the editor and sending those changes to the server
  useEffect(() => {
    if (socket == null || quill == null) return;

    otClient.sendDelta = function (version, delta) {
      socket.emit("send-changes", delta, version);
    };

    const textChangeHandler = (delta, oldDelta, source) => {
      if (source !== "user") return;
      console.log("text changing");
      // emitting "send-changes" event to the server, also passing the delta
      // socket.emit("send-changes", delta);
      console.log(delta);
      console.log(otClient.state);
      otClient.applyFromClient(delta);
    };

    // on "text-change" event of quill
    quill.on("text-change", textChangeHandler);

    return () => {
      quill.off("text-change", textChangeHandler);
    };
  }, [socket, quill]);

  useEffect(() => {
    if (socket == null || quill == null) return;
    function serverAckHandler() {
      otClient.serverAck();
    }
    socket.on("server-ack", serverAckHandler);
  }, [socket]);

  // to display the editor by creating a new Quill instance on first render
  const wrapperRef = useCallback((wrapper) => {
    if (wrapper == null) return;
    // console.log("Inside Editor");
    wrapper.innerHTML = "";
    const editor = document.createElement("div");
    wrapper.append(editor);
    const q = new Quill(editor, {
      theme: "snow",
      modules: { toolbar: TOOLBAR_OPTIONS },
    });
    q.disable(); // initally the text editor is disabled (not editable) (until the document is not accessed)
    q.setText("Loading the document..."); // the text shown until the document is accessed from the server
    setQuill(q);
  }, []);

  return <div className="container" ref={wrapperRef}></div>;
}
