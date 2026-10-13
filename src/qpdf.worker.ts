import createModule from "@neslinesli93/qpdf-wasm";
import wasmUrl from "@neslinesli93/qpdf-wasm/dist/qpdf.wasm?url";
self.onmessage = async ({ data: { bytes, id, password } }) => {
  try {
    // A fresh, disposable worker gives each operation an isolated virtual filesystem.
    const module = await createModule({ locateFile: () => wasmUrl });
    const fs = module.FS as typeof module.FS & {
      writeFile: (path: string, data: Uint8Array) => void;
    };
    fs.writeFile("/input.pdf", bytes);
    let args: string[] = ["/input.pdf", "/output.pdf"];
    if (id === "protect")
      args = [
        "/input.pdf",
        "--encrypt",
        password,
        crypto.randomUUID(),
        "256",
        "--",
        "/output.pdf",
      ];
    if (id === "unlock")
      args = [
        `--password=${password}`,
        "--decrypt",
        "/input.pdf",
        "/output.pdf",
      ];
    if (id === "compress")
      args = [
        "--object-streams=generate",
        "--recompress-flate",
        "--compression-level=9",
        "/input.pdf",
        "/output.pdf",
      ];
    let status: number;
    try {
      status = module.callMain(args);
    } catch (error) {
      // Emscripten throws ExitStatus for qpdf's successful recovery warning (3).
      if (
        typeof error === "object" &&
        error !== null &&
        "status" in error &&
        error.status === 3
      )
        status = 3;
      else throw error;
    }
    if (status !== 0 && status !== 3)
      throw new Error(
        "PDF operation failed. Check the password or try another file.",
      );
    const output = fs.readFile("/output.pdf");
    if (!output.length) throw new Error("No output could be recovered.");
    self.postMessage({ bytes: output });
  } catch {
    self.postMessage({
      error:
        "Unable to process this PDF. Check the password. The file may be encrypted, unsupported, or too damaged to recover.",
    });
  }
};
