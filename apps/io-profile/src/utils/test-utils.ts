// in jest 27 fail is no longer defined, we can define this function as workaround
export const fail = (reason = "fail was called in a test."): never => {
  throw new Error(reason);
};
