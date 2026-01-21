export const omit = <Data extends object, Keys extends keyof Data>(
  keys: Keys[],
  data: Data,
): Omit<Data, Keys> => {
  const result = {} as Omit<Data, Keys>;

  for (const key in data) {
    if (
      Object.prototype.hasOwnProperty.call(data, key) &&
      !keys.includes(key as Extract<Data, string | number | symbol>)
    ) {
    
      result[key as Extract<Data, string | number | symbol>] =
        data[key as Extract<Data, string | number | symbol>];
    }
  }

  return result;
};
