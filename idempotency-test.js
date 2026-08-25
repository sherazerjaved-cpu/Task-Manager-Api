const { Queue } = require("bullmq");
const { MongoClient } = require("mongodb");
require("dotenv").config();

const mongoUri = process.env.MONGODB_URI;

if (!mongoUri) {
  throw new Error("MONGODB_URI is missing from .env");
}

const eventId = "section7-idempotency-test-" + Date.now();

(async () => {
  const mongo = new MongoClient(mongoUri);

  try {
    await mongo.connect();

    const db = mongo.db();

    await db.collection("processedevents").insertOne({
      eventId,
      eventType: "TASK_CREATED",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    console.log("Processed event created:", eventId);

    const queue = new Queue("webhook", {
      connection: {
        host: "localhost",
        port: 6379,
      },
    });

    const job = await queue.add(
      "SECTION_7_IDEMPOTENCY_TEST",
      {
        outboxEventId: eventId,
        workspaceId: "6a769ce2c663a9470b6d7558",
        eventType: "TASK_CREATED",
        payload: {
          test: true,
          idempotencyTest: true,
        },
      },
      {
        attempts: 1,
        removeOnComplete: true,
        removeOnFail: false,
      },
    );

    console.log("Test job created:", job.id);

    await queue.close();
  } finally {
    await mongo.close();
  }
})();
