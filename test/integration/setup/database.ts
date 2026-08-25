import { Connection, STATES } from 'mongoose';

export async function clearDatabase(connection: Connection): Promise<void> {
  if (connection.readyState !== STATES.connected) {
    throw new Error(
      `MongoDB connection is not ready. readyState=${connection.readyState}`,
    );
  }

  const collections = Object.values(connection.collections);

  for (const collection of collections) {
    await collection.deleteMany({});
  }
}

export async function closeDatabase(connection: Connection): Promise<void> {
  if (connection.readyState !== STATES.disconnected) {
    await connection.close();
  }
}
