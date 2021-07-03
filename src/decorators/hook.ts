export const Hook = <T>(target: T, key: keyof T): void => {
  Object.defineProperty(target, key, {
    value: undefined,
    enumerable: true,
    writable: true,
  });
};
