export const get_env_var = (name: string) => {
  return Deno.env.get(name);
};
