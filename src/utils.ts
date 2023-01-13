import log from "./log";

export function getRandomNumber(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1) + min);
}

export function validateEnvironmentVariable(variable: string): void {
  if (process.env[variable] === undefined || process.env[variable] === "") {
    log.error(
      `The "${variable}" environment variable is blank. Specify it in the ".env" file.`,
    );
    process.exit(1);
  }
}
