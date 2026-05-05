import { stdin } from "node:process";

export async function readStdin(): Promise<string> {
  if (stdin.isTTY) {
    return "";
  }

  return new Promise((resolve, reject) => {
    let data = "";
    stdin.setEncoding("utf-8");
    stdin.on("data", (chunk) => {
      data += chunk;
    });
    stdin.on("end", () => {
      resolve(data.trim());
    });
    stdin.on("error", reject);
  });
}
