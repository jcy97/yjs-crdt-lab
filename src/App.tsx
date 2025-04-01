import { useRef, useState } from "react";
import Editor from "@monaco-editor/react";
import * as Y from "yjs";
import { WebrtcProvider } from "y-webrtc";
import { MonacoBinding } from "y-monaco";
import * as monaco from "monaco-editor";
import * as mutex from "lib0/mutex";

// Setup Monaco Editor
// Attach YJS Text to Monaco Editor
const App: React.FC = () => {
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);

  // Editor value -> YJS Text value
  // Initialize YJS, tell it to listen to our Monaco
  function handleEditorDidMount(
    editor: monaco.editor.IStandaloneCodeEditor,
    monacoInstance: typeof monaco
  ): void {
    editorRef.current = editor;

    // Initialize YJS
    const doc = new Y.Doc(); // a collection of shared objects -> Text

    // Connect to peers with WebRTC
    const provider = new WebrtcProvider("test-room", doc, {
      signaling: ["ws://localhost:4444"],
    });
    const type = doc.getText("monaco"); // doc { "monaco" : " what our IED is showing"}

    // Bind YJS to Monaco
    const binding = new MonacoBinding(
      type,
      editorRef.current.getModel()!,
      new Set([editorRef.current]),
      provider.awareness
    );
    console.log(provider.awareness);
  }

  return (
    <Editor
      height="100vh"
      width="100vh"
      theme="vs-dark"
      onMount={handleEditorDidMount}
    />
  );
};

export default App;
