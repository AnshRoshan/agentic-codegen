// Starts the isolated embedded PostgreSQL (port 5434, user postgres/postgres),
// creates the app_db database (UTF-8) if missing, and keeps running until killed.
// Safe to re-run: initialises the data dir only on first launch.
const fs = require("fs");
const path = require("path");
const EmbeddedPostgres = require("embedded-postgres").default;

async function main() {
  const dataDir = path.join(process.cwd(), ".pgdata");
  const fresh = !fs.existsSync(path.join(dataDir, "PG_VERSION"));

  const pg = new EmbeddedPostgres({
    databaseDir: dataDir,
    user: "postgres",
    password: "postgres",
    port: 5434,
    persistent: true,
  });

  if (fresh) {
    await pg.initialise();
  } else {
    // Remove a stale pid file left behind by an unclean shutdown.
    const pidFile = path.join(dataDir, "postmaster.pid");
    if (fs.existsSync(pidFile)) {
      console.log("removing stale postmaster.pid");
      fs.unlinkSync(pidFile);
    }
  }

  await pg.start();
  try {
    await pg.createDatabase("app_db", { encoding: "UTF8", locale: "C" });
    console.log("created app_db");
  } catch (e) {
    if (!/already exists/i.test(e.message)) console.error(e.message);
  }
  console.log("postgres ready on port 5434");
  process.on("SIGINT", async () => { await pg.stop(); process.exit(0); });
  setInterval(() => {}, 1 << 30);
}
main().catch((e) => { console.error(e); process.exit(1); });
