declare module "shutdown-async" {
  function addExitHandler(func: () => Promise<void>): void;
}
