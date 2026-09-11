const { Queue } = require("bullmq");

const queue = new Queue("webhook", {
  connection: {
    host: "localhost",
    port: 6379,
  },
});

(async () => {
  const job = await queue.add(
    "SECTION_7_RETRY_TEST",
    {
      outboxEventId: "section7-retry-test-" + Date.now(),
      eventType: "TASK_CREATED",
      payload: {
        test: true,
      },
      // workspaceId intentionally missing
    },
    {
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 1000,
      },
      removeOnComplete: true,
      removeOnFail: false,
    },
  );

  console.log("Test job created:", job.id);

  await queue.close();
})();
