import { Result, Ok, Err } from "./result.ts";

// Pure type definitions
type CronJob = {
  readonly name: string;
  readonly schedule: string;
  readonly handler: () => Promise<Result<void, Error>>;
  readonly options?: {
    readonly backoffSchedule?: ReadonlyArray<number>;
  };
};

// Factory function for creating cron jobs
export const createCronJob = (
  name: string,
  schedule: string,
  handler: () => Promise<Result<void, Error>>,
  options?: {
    backoffSchedule?: ReadonlyArray<number>;
  }
): CronJob => ({
  name,
  schedule,
  handler,
  options,
});

// Register all cron jobs
export const registerCronJobs = (jobs: ReadonlyArray<CronJob>): void => {
  jobs.forEach(job => {
    Deno.cron(
      job.name,
      job.schedule,
      job.options || {},
      async () => {
        console.log(`Running cron job: ${job.name}`);
        const result = await job.handler();

        if (result.isErr()) {
          console.error(`Cron job ${job.name} failed:`, result.unwrapErr());
          throw result.unwrapErr(); // Trigger backoff retry
        }

        console.log(`Cron job ${job.name} completed successfully`);
      }
    );
  });
};