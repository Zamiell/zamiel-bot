// The functions here are copied from `isaacscript-common-ts` because this package uses CommonJS
// instead of ESM.

/* eslint-disable @typescript-eslint/no-explicit-any */

interface ReadonlyMapConstructor {
  new (): ReadonlyMap<any, any>;
  new <K, V>(
    entries?: ReadonlyArray<readonly [K, V]> | Iterable<readonly [K, V]> | null,
  ): ReadonlyMap<K, V>;
  readonly prototype: ReadonlyMap<any, any>;
}

/** An alias for the `Map` constructor that returns a read-only map. */
export const ReadonlyMap = Map as ReadonlyMapConstructor;

interface ReadonlySetConstructor {
  new <T = any>(values?: readonly T[] | Iterable<T> | null): ReadonlySet<T>;
  readonly prototype: ReadonlySet<any>;
}

/** An alias for the `Set` constructor that returns a read-only set. */
export const ReadonlySet = Set as ReadonlySetConstructor;

/**
 * Shallow copies and removes the specified element(s) from the array. Returns the copied array. If
 * the specified element(s) are not found in the array, it will simply return a shallow copy of the
 * array.
 *
 * This function is variadic, meaning that you can specify N arguments to remove N elements.
 */
export function arrayRemove<T>(
  originalArray: T[] | readonly T[],
  ...elementsToRemove: T[]
): T[] {
  const elementsToRemoveSet = new ReadonlySet(elementsToRemove);

  const array: T[] = [];
  for (const element of originalArray) {
    if (!elementsToRemoveSet.has(element)) {
      array.push(element);
    }
  }

  return array;
}

/**
 * Helper function to throw an error if the provided value is equal to `undefined`.
 *
 * This is useful to have TypeScript narrow a `T | undefined` value to `T` in a concise way.
 */
export function assertDefined<T>(
  value: T,
  ...[msg]: [undefined] extends [T]
    ? [string]
    : [
        "The assertion is useless because the provided value does not contain undefined.",
      ]
): asserts value is Exclude<T, undefined> {
  if (value === undefined) {
    throw new TypeError(msg);
  }
}

/**
 * Helper function to get a random element from the provided array.
 *
 * Note that this will only work with arrays that do not contain values of `undefined`, since the
 * function uses `undefined` as an indication that the corresponding element does not exist.
 *
 * @param array The array to get an element from.
 * @param exceptions Optional. An array of elements to skip over if selected.
 */
export function getRandomArrayElement<T>(
  array: T[] | readonly T[],
  exceptions: T[] | readonly T[] = [],
): T {
  if (array.length === 0) {
    throw new Error(
      "Failed to get a random array element since the provided array is empty.",
    );
  }

  const arrayToUse =
    exceptions.length > 0 ? arrayRemove(array, ...exceptions) : array;
  const randomIndex = getRandomArrayIndex(arrayToUse);
  const randomElement = arrayToUse[randomIndex];
  assertDefined(
    randomElement,
    `Failed to get a random array element since the random index of ${randomIndex} was not valid.`,
  );

  return randomElement;
}

/**
 * Helper function to get a random index from the provided array.
 *
 * @param array The array to get the index from.
 * @param exceptions Optional. An array of indexes that will be skipped over when getting the random
 *                   index. Default is an empty array.
 */
export function getRandomArrayIndex<T>(
  array: T[] | readonly T[],
  exceptions: number[] | readonly number[] = [],
): number {
  if (array.length === 0) {
    throw new Error(
      "Failed to get a random array index since the provided array is empty.",
    );
  }

  return getRandomInt(0, array.length - 1, exceptions);
}

/**
 * This returns a random integer between min and max. It is inclusive on both ends.
 *
 * For example:
 *
 * ```ts
 * const oneTwoOrThree = getRandomInt(1, 3);
 * ```
 *
 * @param min The lower bound for the random number (inclusive).
 * @param max The upper bound for the random number (inclusive).
 * @param exceptions Optional. An array of elements that will be skipped over when getting the
 *                   random integer. For example, a min of 1, a max of 4, and an exceptions array of
 *                   `[2]` would cause the function to return either 1, 3, or 4. Default is an empty
 *                   array.
 */
export function getRandomInt(
  min: number,
  max: number,
  exceptions: number[] | readonly number[] = [],
): number {
  min = Math.ceil(min); // eslint-disable-line no-param-reassign
  max = Math.floor(max); // eslint-disable-line no-param-reassign

  if (min > max) {
    const oldMin = min;
    const oldMax = max;

    min = oldMax; // eslint-disable-line no-param-reassign
    max = oldMin; // eslint-disable-line no-param-reassign
  }

  const exceptionsSet = new ReadonlySet(exceptions);

  let randomInt: number;
  do {
    randomInt = Math.floor(Math.random() * (max - min + 1)) + min;
  } while (exceptionsSet.has(randomInt));

  return randomInt;
}

/**
 * Helper function to signify that the enclosing code block is not yet complete. Using this function
 * is similar to writing a "TODO" comment, but it has the benefit of preventing ESLint errors due to
 * unused variables or early returns.
 *
 * When you see this function, it simply means that the programmer intends to add in more code to
 * this spot later.
 *
 * This function is variadic, meaning that you can pass as many arguments as you want. (This is
 * useful as a means to prevent unused variables.)
 *
 * This function does not actually do anything. (It is an "empty" function.)
 *
 * @allowEmptyVariadic
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/no-empty-function
export function todo(...args: unknown[]): void {}
