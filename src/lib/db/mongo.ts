// Explanation: This file manages the connection to the MongoDB database.
// It implements a singleton pattern using global variables to ensure we only create one connection pool,
// even when the server hot-reloads during development (HMR), preventing "Topology Closed" errors.

import { MongoClient, type Db } from 'mongodb';
import { MONGODB_URI, MONGODB_DB } from '../config/env';

// Use global variable to preserve connection across HMR in development
// @ts-ignore
let client: MongoClient = global._mongoClient;
// @ts-ignore
let db: Db = global._mongoDb;

export async function getDb(): Promise<Db> {
  if (db && client) return db;

  if (!client) {
    if (!MONGODB_URI) {
      throw new Error('MONGODB_URI is not defined in environment variables');
    }
    
    try {
      client = new MongoClient(MONGODB_URI);
      await client.connect();
      console.log('Connected to MongoDB');
    } catch (error) {
      console.error('MongoDB connection error:', error);
      throw error;
    }
    
    // @ts-ignore
    global._mongoClient = client;
  }

  if (!db) {
    db = client.db(MONGODB_DB);
    // @ts-ignore
    global._mongoDb = db;
  }
  
  return db;
}

export async function closeDb() {
  if (client) {
    await client.close();
    client = undefined!;
    db = undefined!;
    // @ts-ignore
    global._mongoClient = undefined;
    // @ts-ignore
    global._mongoDb = undefined;
  }
}
