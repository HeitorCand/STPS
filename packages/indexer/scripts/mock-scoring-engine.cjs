const http = require("node:http");

const server = http.createServer((req, res) => {
  let body = "";

  req.on("data", (chunk) => {
    body += chunk;
  });

  req.on("end", () => {
    console.log(`${req.method} ${req.url}`);
    if (body) console.log(body);

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true }));
  });
});

server.listen(3001, () => {
  console.log("mock scoring on http://localhost:3001");
});
