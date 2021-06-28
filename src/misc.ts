import log from "./log";

export function getRandomNumber(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1) + min);
}

// parseIntSafe is a more reliable version of parseInt
// By default, "parseInt('1a')" will return "1", which is unexpected
// This returns either an integer or NaN
export function parseIntSafe(input: string): number {
  if (typeof input !== "string") {
    return NaN;
  }

  // Remove all leading and trailing whitespace
  let trimmedInput = input.trim();

  const isNegativeNumber = trimmedInput.startsWith("-");
  if (isNegativeNumber) {
    // Remove the leading minus sign before we match the regular expression
    trimmedInput = trimmedInput.substring(1);
  }

  if (/^\d+$/.exec(trimmedInput) === null) {
    // "\d" matches any digit (same as "[0-9]")
    return NaN;
  }

  if (isNegativeNumber) {
    // Add the leading minus sign back
    trimmedInput = `-${trimmedInput}`;
  }

  return parseInt(trimmedInput, 10);
}

export function validateEnvironmentVariable(variable: string): void {
  if (process.env[variable] === undefined || process.env[variable] === "") {
    log.error(
      `The "${variable}" environment variable is blank. Specify it in the ".env" file.`,
    );
    process.exit(1);
  }
}
