
let uri: string | undefined;
let dbName: string | undefined;

// @ts-ignore
if (typeof import.meta !== 'undefined' && import.meta.env) {
  // @ts-ignore
  uri = import.meta.env.MONGODB_URI;
  // @ts-ignore
  dbName = import.meta.env.MONGODB_DB;
}

if (!uri && typeof process !== 'undefined' && process.env) {
  // Local: use docker-compose Mongo or local instance
  // Render: this will be the connection string to MongoDB Atlas
  uri = process.env.MONGODB_URI;
  dbName = process.env.MONGODB_DB;
}

export const MONGODB_URI = uri;
export const MONGODB_DB = dbName;

if (!MONGODB_URI) {
  console.error("MONGODB_URI is not defined in environment variables");
  throw new Error("MONGODB_URI is not defined in environment variables");
}

if (!MONGODB_DB) {
  console.error("MONGODB_DB is not defined in environment variables");
  throw new Error("MONGODB_DB is not defined in environment variables");
}

let sessionSecret = "default_secret_change_me_in_prod";
let sessionCookieName = "flowboard_session";
let sessionTtlDays = 14;
let passwordBcryptRounds = 12;

// @ts-ignore
if (typeof import.meta !== 'undefined' && import.meta.env) {
    // @ts-ignore
    if(import.meta.env.SESSION_SECRET) sessionSecret = import.meta.env.SESSION_SECRET;
    // @ts-ignore
    if(import.meta.env.SESSION_COOKIE_NAME) sessionCookieName = import.meta.env.SESSION_COOKIE_NAME;
    // @ts-ignore
    if(import.meta.env.SESSION_TTL_DAYS) sessionTtlDays = parseInt(import.meta.env.SESSION_TTL_DAYS);
    // @ts-ignore
    if(import.meta.env.PASSWORD_BCRYPT_ROUNDS) passwordBcryptRounds = parseInt(import.meta.env.PASSWORD_BCRYPT_ROUNDS);
}

if (typeof process !== 'undefined' && process.env) {
    if(process.env.SESSION_SECRET) sessionSecret = process.env.SESSION_SECRET;
    if(process.env.SESSION_COOKIE_NAME) sessionCookieName = process.env.SESSION_COOKIE_NAME;
    if(process.env.SESSION_TTL_DAYS) sessionTtlDays = parseInt(process.env.SESSION_TTL_DAYS);
    if(process.env.PASSWORD_BCRYPT_ROUNDS) passwordBcryptRounds = parseInt(process.env.PASSWORD_BCRYPT_ROUNDS);
}

export const SESSION_SECRET = sessionSecret;
export const SESSION_COOKIE_NAME = sessionCookieName;
export const SESSION_TTL_DAYS = sessionTtlDays;
export const PASSWORD_BCRYPT_ROUNDS = passwordBcryptRounds;
