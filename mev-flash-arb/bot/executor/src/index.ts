import Database from "better-sqlite3";
import pino from "pino";
import { Counter, Gauge, Registry } from "prom-client";

const logger = pino({ name: "executor" });
const db = new Database("bundles.db");

const registry = new Registry();
const opportunities = new Counter({ name: "opportunities_found_total", help: "found", registers: [registry] });
const submitted = new Counter({ name: "bundles_submitted_total", help: "submitted", registers: [registry] });
const included = new Counter({ name: "bundles_included_total", help: "included", registers: [registry] });
const profit = new Gauge({ name: "bundle_profit_usdc", help: "profit", registers: [registry] });

db.exec(`
CREATE TABLE IF NOT EXISTS bundle_attempts (
  id INTEGER PRIMARY KEY,
  opportunity_id TEXT,
  target_block INTEGER,
  status TEXT,
  gas_used TEXT,
  profit_usdc TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
)`);

export function recordBundle(opportunityId: string, targetBlock: number, status: string, gasUsed: string, profitUsdc: string) {
  opportunities.inc();
  submitted.inc();
  if (status === "included") included.inc();
  profit.set(Number(profitUsdc));
  const stmt = db.prepare("INSERT INTO bundle_attempts(opportunity_id,target_block,status,gas_used,profit_usdc) VALUES(?,?,?,?,?)");
  stmt.run(opportunityId, targetBlock, status, gasUsed, profitUsdc);
}

async function main() {
  recordBundle("demo", 0, "simulated", "0", "0");
  logger.info(await registry.metrics(), "metrics");
}

if (require.main === module) {
  main().catch((err) => {
    logger.error(err);
    process.exit(1);
  });
}
