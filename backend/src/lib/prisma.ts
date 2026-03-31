// Prisma singleton client
// Prisma 7 requires a database adapter to be passed explicitly.
// We create a pg.Pool with SSL configured, then pass it to PrismaPg.
// rejectUnauthorized: false tells Node to accept Supabase's certificate chain.

import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import dotenv from "dotenv";

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL!,
  ssl: { rejectUnauthorized: false },
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

export default prisma;
